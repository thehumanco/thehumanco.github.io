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

<p class="paper-link"><a href="/blogs/robocap/report.html">Read the technical report (PDF)</a><span class="sep">·</span><a href="https://robocap.io">Buy a RoboCap</a><span class="sep">·</span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>

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

Head motion is the other half of the world-frame picture, and egocentric head motion is a distinctly adversarial setting for SLAM: rapid rotation, close-range parallax, the wearer's own hands moving through the scene, and irregular motion during initialization. Our multi-camera visual-inertial system is built on now-standard ingredients: GPU feature tracking, a keyframe-graph inertial estimator with marginalization, and appearance-based place recognition. Every camera on the device contributes to a single estimate, including the lateral views that have no overlapping partner and so carry landmarks of their own, which is what keeps the solver constrained when the wearer's hands are close to the face and the front pair sees little else. Camera–IMU timing and the stereo extrinsics are refined per session.

Two choices matter more than the rest: landmarks are recognized on return rather than merely forgotten when they leave the window, and a recognized revisit is applied inside the visual-inertial estimator itself rather than handed to a separate pose-graph stage, so the correction is weighted by the same cost that produced the estimate. The trajectories below are the offline product of the system, with a final global BA over the session's keyframes once all revisits are known.

We evaluate one configuration, with the cameras each dataset provides for SLAM and no per-dataset tuning, against ORB-SLAM3, Basalt, OKVIS2 and cuVSLAM. For head-worn capture at room scale we match or better the best result on every benchmark, and we are the only system that completes all of them: Monado, ADT and HOT3D are finished without a failure, where the strongest baseline on each loses one, three and six sequences. On EuRoC and the TUM-VI rooms we are at parity with OKVIS2 and ORB-SLAM3, whose published figures those benchmarks were tuned against over a decade. On VECtor we lead the nearest system by a factor of four in median error, and on the Aria sets our error is at the level of the MPS pseudo-ground truth and should be read as agreement with it. The causal estimate produced online during capture stays within a factor of two of the offline column.

<figure class="figures">
  <img src="/blogs/robocap/05_scene_reconstruction.jpg" alt="Scene reconstruction over four RoboCap sessions">
  <figcaption>Scene reconstruction over four RoboCap sessions. Point clouds from each session are projected into a gravity-aligned world frame, and multi-session alignment is solved with RANSAC on 3D-projected SIFT features.</figcaption>
  <div class="figure-table">
    <table>
      <thead>
        <tr><th>Benchmark</th><th>ORB-SLAM3</th><th>Basalt</th><th>OKVIS2</th><th>cuVSLAM</th><th>Ours</th></tr>
      </thead>
      <tbody>
        <tr><td>EuRoC</td><td>3.5 / 3.3</td><td>5.8 / 5.5</td><td>3.1 / 2.3</td><td>6.6 / 8.4<sup>(4)</sup></td><td><strong>2.7 / 2.4</strong></td></tr>
        <tr><td>TUM-VI (rooms)</td><td><strong>0.9 / 0.9</strong></td><td>9.2 / 6.3</td><td><strong>0.9 / 0.9</strong></td><td>2.0 / 1.7</td><td><strong>0.9 / 0.9</strong></td></tr>
        <tr><td>VECtor</td><td>14.7 / 23.0<sup>(5)</sup></td><td>28.0 / 71.1<sup>(7)</sup></td><td>25.7 / 16.8<sup>(3)</sup></td><td>16.5 / 36.0<sup>(7)</sup></td><td><strong>10.5 / 4.0</strong><sup>(4)</sup></td></tr>
        <tr><td>Monado*</td><td>– / 2.5</td><td>– / 11.2</td><td>– / 2.2</td><td>11.5 / 11.5<sup>(20)</sup></td><td><strong>3.0 / 2.2</strong></td></tr>
        <tr><td>ADT†</td><td>2.0 / 1.8<sup>(3)</sup></td><td>11.2 / 6.5<sup>(3)</sup></td><td>5.4 / 3.0<sup>(4)</sup></td><td>15.9 / 6.9<sup>(12)</sup></td><td><strong>2.0 / 1.8</strong></td></tr>
        <tr><td>HOT3D†</td><td>1.3 / ∞<sup>(18)</sup></td><td>4.5 / 4.7<sup>(4)</sup></td><td>1.7 / 1.7<sup>(6)</sup></td><td>46.9 / 55.4<sup>(6)</sup></td><td><strong>0.4 / 0.3</strong></td></tr>
      </tbody>
    </table>
  </div>
  <figcaption>Final (offline) ATE RMSE in cm, mean / median over sequences. A crash or an ATE above 1 m is a failure, counted as (n): excluded from the mean and ∞ in the median. Published numbers are used where they exist; otherwise each system's released code is run with its published configuration on the same inputs. *Monado baselines are the non-causal aggregate medians reported by the dataset authors, and means are not published. †Aria datasets with pseudo-ground truth from Aria MPS.</figcaption>
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

<p class="paper-link"><a href="/blogs/robocap/report.html">Read the technical report (PDF)</a><span class="sep">·</span><a href="https://robocap.io">Buy a RoboCap</a><span class="sep">·</span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>
