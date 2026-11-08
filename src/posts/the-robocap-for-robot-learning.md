---
title: The RoboCap, for Robot Learning
date: September 2026
order: 4
author: Vincent Liu, Ademi Adeniji
description: A deep dive into the hardware and our state-of-the-art 3D AI models
unrelease: false
---

<div class="teaser">
  <img src="/blogs/robocap/01a_robocap_exploded.jpg" alt="RoboCap, exploded view">
  <img src="/blogs/robocap/01b_robocap_views.jpg" alt="Synchronized views from RoboCap's cameras">
  <img src="/blogs/robocap/01c_robocap_hands.jpg" alt="Hand poses reconstructed from RoboCap footage">
</div>

<p class="paper-link"><a href="/blogs/robocap/robocap_a_new_platform_for_egocentric_robot_learning.pdf">Read the technical report (PDF)</a><span class="sep"> · </span><a href="https://robocap.io">Buy a RoboCap</a><span class="sep"> · </span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>

Every generation of large-scale robot learning has been defined by the data it could afford to collect, and each source of that data comes with a known cost. Simulation scales with compute, but demands engineering effort that grows with the diversity it aims to produce. Teleoperation captures exactly the states and actions a robot needs at inference, but at the price of slow, unnatural demonstrations through cumbersome robot hardware. UMI-style handheld grippers deploy only the end-effector and scale further, yet they do not generalize past low-DoF manipulators. Egocentric capture, where a person simply wears a device and goes about their work, scales the furthest of all, because the bottleneck becomes human time rather than hardware.

Because human poses must be retargetted fully onto a robot embodiment, the quality of its estimation dictates the resulting policy's accuracy. Therefore, a centimeter of hand-pose error becomes a centimeter of error in the action the robot imitates. Egocentric capture is a metrology problem before it is a video collection problem, and a large-scale 3D computer vision problem in practice. Centimeter-level accuracy has to hold under occlusion, motion blur, varied lighting, and operator diversity, on footage collected outside any lab. The field has not converged on an egocentric device the way it has on teleoperation and UMI rigs, and we think the reason is simple: the two halves of the problem, form factor and 3D algorithms, have never been available together. So we built it, and we are releasing both halves together: [RoboCap](https://robocap.io), a 250 g six-camera, dual-IMU hat designed for in-the-wild capture, and the [Grounded API](https://app.gsi.company), a suite of device-agnostic SLAM, depth estimation, and hand tracking algorithms tuned for it.

## A device designed from the math

Our central hardware claim is that the 3D estimation problem in egocentric data is largely an artifact of devices that were never designed for it. Consumer smart glasses optimize for display, audio, and how they look on a face, and mixed-reality headsets optimize for rendering; in both, the cameras serve those goals and 3D estimation inherits whatever is left over. We demonstrate that when a device is designed backward from what metric 3D estimation needs for manipulation, it is possible to achieve precision that policy learning can use.

RoboCap follows that specification closely. Its six hardware-synchronized global-shutter cameras (1920×1080 at 30 Hz) do not share optics. The two calibrated stereo pairs carry fisheye lenses spanning 180°×112°, a front pair on an 86.8 mm baseline with 157° of binocular overlap and an eye pair on a 106.2 mm baseline with 154°, which keeps the hands inside a metric stereo frustum across the full reach envelope. The two lateral cameras instead carry a wide 161°×98° lens, mounted 85° off the forward axis and pitched 30° down, where the priority is catching reaches that leave the stereo frustum entirely. Two IMUs sit at opposite sides of the crown. Every camera fires from a single PWM trigger fanned out through a 1-to-6 buffer, so simultaneity holds by construction.

<figure class="figures">
  <img src="/blogs/robocap/02_camera_coverage.jpg" alt="RoboCap camera coverage">
  <figcaption>RoboCap camera coverage. Left: azimuth coverage of the front stereo and lateral cameras. Center: azimuth coverage of the eye stereo cameras, visualized forward for legibility. Right: elevation coverage of the front and eye pairs. Overlap is the binocular field at infinity.</figcaption>
</figure>

## Online calibration, the key to sub-centimeter accuracy

Every unit is individually calibrated at the factory against an AprilGrid target, and units are only shipped if they pass strict per-parameter tolerance gates. However, mechanical and thermal stress inevitably shift the rig slightly, and at manipulation range that is not a second-order effect, because one pixel of disparity error corresponds to roughly a centimeter of depth at 0.65 m. Across 150 deployed devices, factory calibration leaves a median front-pair epipolar residual of 3.8 px, which online calibration reduces to 0.56 px, and switching from one to the other changes in-reach depth by a median of 3.6% per device (11% at the 90th percentile), moving 31% of in-reach pixels by more than 5%. This is not unique to our hardware; Aria reports roughly 25 arcmin of instantaneous deformation between its stereo cameras from the simple act of taking the glasses off.

Rather than fight a drift that cannot be eliminated mechanically, we correct it once per recording session, from natural correspondences in the footage itself, with no calibration target and no operator involvement. Because the drift is dominated by rotation, translations are held at their factory values and only the relative rotation of each stereo pair is adjusted, with the left-front camera fixed as the anchor. Each pair is fit independently against the Sampson epipolar distance, and a correction is accepted only if it improves a held-out residual and lands within about 1° of that device's own factory value. As we detail in our technical report, we find that online calibration halves the depth error

<figure class="figures">
  <img src="/blogs/robocap/03_epipolar_before_after.jpg" alt="Epipolar residuals before and after self-calibration">
  <figcaption>Epipolar residuals before (top) and after (bottom) self-calibration. Identical features are marked in the left and right cameras, with epipolar lines drawn across each pair.</figcaption>
  <!-- <img src="/blogs/robocap/04_epipolar_drift_histograms.jpg" alt="Histograms of epipolar drift across deployed devices">
  <figcaption>Epipolar drift in the eye pair (left), front pair (middle), and front-eye pairs (right) over 150 deployed devices. The drift follows a Gaussian centered around 0°, which is why a rotational correction is sufficient.</figcaption> -->
  <img src="/blogs/robocap/06_depth_factory_vs_online.jpg" alt="FFS depth with factory versus online calibration">
  <figcaption>FFS depth with factory vs. online calibration, and the depth change between them. Factory calibration does not visibly degrade the depth maps, which stay sharp and complete but are systematically distorted in scale and shape; online calibration removes this distortion.</figcaption>
</figure>

## The best of every SLAM, in one estimator

Head motion is the other half of the world-frame picture, and egocentric head motion is a distinctly adversarial setting for SLAM: rapid rotation, close-range parallax, the wearer's own hands moving through the scene, and irregular motion during initialization. Our multi-camera visual-inertial system is built from established components: a GPU-accelerated patch-based optical-flow front-end with a square-root sliding-window estimator, appearance-based place recognition, and an offline keyframe bundle adjustment. One configuration is used for every device and dataset, and the few rig-dependent choices are derived from the rig itself.

All cameras feed one estimator. Cameras with overlapping fields of view form a stereo pair, giving landmarks metric depth from their first frame; on RoboCap that is the front pair, while the lateral cameras track their own landmarks monocularly and keep the estimator constrained when the hands cover the front pair. Images are downsampled to at most 1000 px wide, since at full resolution tracks die under motion blur and low light. The estimator is initialized from motion and re-initialized when a divergence check detects implausible biases or pose jumps. Reported trajectories come from an offline visual-inertial bundle adjustment over all keyframes, run once all revisits are known, in which recognized revisits enter as merged landmarks and relative-pose constraints; the causal estimate produced during capture uses the same front-end and estimator, with pose-graph loop closure in place of that refinement.

LaMAria is the closest public match to our setting: a head-worn multi-camera visual-inertial device recording everyday walking, at city scale. Its 63 test recordings total 27.5 hours and 76 km, with single walks of up to 48 minutes and 2.2 km, and two categories target known failure modes, walks at night and rides on moving platforms. Ground truth is withheld, and trajectories are scored by the benchmark server against surveyed control points. The benchmark is far from saturated: apart from ours, only Aria's own SLAM scores above 35 in any category, and established and recent learned systems lose track on the long walks. Our system ranks second and exceeds the best other entry by 26 to 46 points in every category, with trajectories within 5 m of the control points for 96–100% of the points, against 37–73% for the best other entries.

<figure class="figures">
  <div class="figure-table">
    <table>
      <thead>
        <tr><th>Method</th><th>Inputs</th><th>Short</th><th>Medium</th><th>Long</th><th>Low light</th><th>Moving</th><th>Avg.</th></tr>
      </thead>
      <tbody>
        <tr class="muted"><td>Aria’s SLAM‡</td><td>bino, IMU</td><td>90.7</td><td>78.5</td><td>70.9</td><td>84.2</td><td>55.0</td><td>75.9</td></tr>
        <tr><td>ORB-SLAM3</td><td>mono, IMU</td><td>23.0</td><td>10.9</td><td>11.2</td><td>3.1</td><td>2.0</td><td>10.0</td></tr>
        <tr><td>OKVIS2</td><td>bino, IMU</td><td>20.0</td><td>11.6</td><td>2.6</td><td>14.5</td><td>4.7</td><td>10.7</td></tr>
        <tr><td>OpenVINS+Maplab</td><td>bino, IMU</td><td>27.7</td><td>23.4</td><td>12.8</td><td>19.8</td><td>13.9</td><td>19.5</td></tr>
        <tr><td>Best of other submissions</td><td>mono, IMU</td><td>34.2</td><td>29.3</td><td>16.8</td><td>25.4</td><td>15.5</td><td>24.2</td></tr>
        <tr class="noline"><td>Ours</td><td>bino, IMU</td><td><strong>80.2</strong></td><td><strong>61.6</strong></td><td><strong>59.9</strong></td><td><strong>67.7</strong></td><td><strong>41.9</strong></td><td><strong>62.3</strong></td></tr>
        <tr class="subrow"><td>pose recall @5 m (%)</td><td></td><td>99.9</td><td>96.2</td><td>99.3</td><td>99.9</td><td>–</td><td></td></tr>
      </tbody>
    </table>
  </div>
  <figcaption>Official LaMAria test-set results (control-point score, higher is better). Baselines marked as reproduced by the benchmark authors; "best of other submissions" is the highest score per category over all other public entries. ‡Aria's SLAM is excluded from the ranking as a reference: it is the device manufacturer's own system, developed together with the glasses, and the solution used to initialize the benchmark's ground-truth pipeline.</figcaption>
</figure>

Run unchanged on five further public benchmarks with different rigs and motion — EuRoC, the TUM-VI rooms, VECtor, Monado and the Aria recordings of ADT and HOT3D — the same configuration is on par with or better than the strongest published systems, and the per-sequence numbers are in the technical report. Two limitations remain. Very fast rotation, above roughly 500°/s where some gyroscopes also saturate, defeats the patch tracker. And loop-closure recall in long featureless halls is weaker than with longer feature tracks: across all 20 TUM-VI sequences, where hall sequences have ground truth only in the start and end room, our median error is 8.1 cm.

<figure class="figures">
  <img src="/blogs/robocap/05_scene_reconstruction.jpg" alt="Scene reconstruction over four RoboCap sessions">
  <figcaption>Scene reconstruction over four RoboCap sessions. Point clouds from each session are projected into the SLAM world frame, leveled with the estimated gravity direction, and multi-session alignment is solved with RANSAC on 3D-projected SIFT features.</figcaption>
</figure>

## Solving hand tracking without any mocap

Hand tracks are what robot policies ultimately learn from, but estimating them from complex in-the-wild video is extremely hard. In-the-wild recordings are dominated by visual and geometric edge cases rather than clean lab imagery, and no single camera sees the hands at all times, so estimates have to fuse views of very different appearance under frequent occlusion. We treat it as a multi-view problem from the start, because monocular hand models are both metrically ambiguous and inconsistent across views: each view regresses shape and depth independently under a weak-perspective camera, and triangulating those outputs directly produces distorted hands with many centimeters of error in the local hand frame alone.

The deeper constraint is where the labels come from. Every existing hand-pose corpus derives its ground truth from a motion-capture installation or a closed on-device tracker, which means annotation cost scales with instrumentation rather than compute, and collection is confined to instrumented space. [Meta recently released a paper](https://arxiv.org/abs/2603.28760) addressing this by building a large exoskeleton cage. Yet the difficulty of hand tracking lives precisely in the wild, where accuracy has to persist through motion blur, gloves, occlusion, and lighting that no mocap studio reproduces.

Instead, we generate our labels without motion capture at all. We create a custom in-the-wild RoboCap dataset spanning diverse skin tones, gloves, object occlusions, and motion blur, labeled by an offline multi-view optimization: monocular priors are bootstrapped into a multi-view hand reconstruction model, and a single MANO parameterization is then fit through differentiable refinement that optimizes for reprojected appearance and naturalness across the whole trajectory. The tracking model itself is a feed-forward multi-view ViT that consumes raw crops and camera parameters and predicts one hand pose across all views, so multi-view consistency holds by construction.

To isolate what that pretraining corpus is worth, we train the same architecture on three public egocentric datasets, HOT3D, UmeTrack, and SHOW3D, ablating only the effect of our pre-training. These span three headset types with different camera counts, placements, and optics, all unlike the rig we pretrained on. Pretraining reduced error on all three, by 2.9 to 7.5 mm, or 17–40%. We also compare against POEMv2, a state-of-the-art multi-view hand pose model, on third-person benchmarks that are out of distribution for us in both viewpoint and camera configuration. After fine-tuning for 20k steps, we surpass it on DexYCB (5.70 vs. 6.69 mm) and OakInk (7.34 vs. 8.34 mm), but fall behind on HO3D (15.16 vs. 7.72 mm), where some test sequences drop two of five cameras and a model trained on a single consistent rig struggles to adapt without more fine-tuning. Finally, on an internal synthetic benchmark rendered with real RoboCap intrinsics and extrinsics, we achieve sub-centimeter accuracy at 9.2 mm, though we do not believe synthetic or motion-capture data captures the real difficulty of in-the-wild tracking.

<figure class="figures">
  <img src="/blogs/robocap/07_hand_tracking_robustness.jpg" alt="Hand tracking examples under difficult conditions, degraded imaging, and hand-object interaction">
  <figcaption>Our hand tracking model fuses multi-view images into a single hand mesh, and is robust to numerous edge cases we encounter during in-the-wild data collection.</figcaption>
  <div class="figure-table figure-table--pair">
    <div>
      <table>
        <thead>
          <tr><th>Dataset</th><th>Scratch</th><th>Pretrained</th></tr>
        </thead>
        <tbody>
          <tr><td>HOT3D</td><td>17.41</td><td><strong>14.47</strong></td></tr>
          <tr><td>UmeTrack</td><td>19.00</td><td><strong>11.49</strong></td></tr>
          <tr><td>SHOW3D</td><td>19.34</td><td><strong>13.68</strong></td></tr>
        </tbody>
      </table>
      <figcaption>MPJPE (mm) on Meta's mocap datasets, ablating the effect of our pre-training.</figcaption>
    </div>
    <div>
      <table>
        <thead>
          <tr><th>Benchmark</th><th>POEMv2</th><th>Ours</th></tr>
        </thead>
        <tbody>
          <tr><td>DexYCB-Mv</td><td>6.69</td><td><strong>5.70</strong></td></tr>
          <tr><td>OakInk-Mv</td><td>8.34</td><td><strong>7.34</strong></td></tr>
          <tr><td>HO3D-Mv</td><td><strong>7.72</strong></td><td>15.16</td></tr>
        </tbody>
      </table>
      <figcaption>MPJPE (mm) on third-person multi-view benchmarks.</figcaption>
    </div>
  </div>
</figure>

## Limitations

Our hardware makes a specific bet. Designing the sensing suite backward from metric 3D estimation buys precision at manipulation range, but it also fixes the geometry: the working volume is set by the stereo baselines and lateral coverage, and reaches that leave every frustum cannot be recovered. The device also assumes a tethered battery bank, which suits deliberate collection but not ambient all-day wear, a form-factor tradeoff we do not regard as permanent. Our SLAM matches or exceeds the published systems on every benchmark we report, but not uniformly. It struggles on long, self-similar loops, where too few revisits are recognized to correct the drift accumulated around them; this is a limit of place-recognition recall rather than of the estimator.

Hand-tracking evaluation remains the weakest link, and not only for us. No public dataset offers what egocentric manipulation calls for all at once, namely short-baseline rectified stereo, a head-worn viewpoint, and dense independent ground truth under visually diverse edge cases, so we measure transfer indirectly against ground truth on other rigs. Most importantly, this work establishes precision, not its downstream effect on policy performance. We have argued that label error enters a policy's training distribution as noise, and prior work supports that link, but we have not yet measured how much downstream performance a centimeter actually buys. That requires training policies at scale on data this stack produces, and it is what we are working on now.

## Closing remarks

Egocentric data is one of the most scalable sources available to robot learning, but collecting it at the precision and scale that policy learning requires has demanded two things at once: hardware built for 3D estimation, and algorithms robust enough to run unattended on in-the-wild footage. Neither has been something a team could simply buy or call. RoboCap and the Grounded API are our attempt to make both available.

The result we find most consequential is not any single benchmark number, but what bootstrapping 3D labels for in-the-wild data implies about scale. If precise SLAM, depth estimation, and hand tracking do not require motion capture, then the diversity of hand-pose data is no longer bounded by the reach of instrumented spaces, and models trained this way can adapt better than models trained on motion capture itself. Both the device and the API are available today, and we expect the field to find failure modes in them that we have not.

<p class="paper-link"><a href="/blogs/robocap/robocap_a_new_platform_for_egocentric_robot_learning.pdf">Read the technical report (PDF)</a><span class="sep"> · </span><a href="https://robocap.io">Buy a RoboCap</a><span class="sep"> · </span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>
