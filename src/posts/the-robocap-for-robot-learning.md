---
title: The RoboCap, for Robot Learning
date: September 2026
order: 3
author: Ademi Adeniji, Vincent Liu
description: A deep dive into the hardware and our state-of-the-art 3D AI models
unrelease: false
---

<div class="teaser">
  <img src="/blogs/robocap/01a_robocap_exploded.jpg" alt="RoboCap, exploded view">
  <img src="/blogs/robocap/01b_robocap_views.jpg" alt="Synchronized views from RoboCap's cameras">
  <img src="/blogs/robocap/01c_robocap_hands.jpg" alt="Hand poses reconstructed from RoboCap footage">
</div>

Robot learning keeps running into the same wall: there isn't enough data of humans doing things with their hands, labeled precisely enough to train on.

Every existing way of getting that data trades something away. Simulation scales with compute but needs engineering effort proportional to the diversity you want out of it. Teleoperation gives you exactly the states and actions a robot sees at inference, but demonstrations are slow, unnatural, and bounded by how many robots you own. UMI-style handheld grippers scale better but don't generalize past low-DoF manipulators. Egocentric capture — put a device on a person and let them work — is the one that scales, because the bottleneck becomes human time rather than hardware.

The catch is that egocentric data gives you video, not state. Hand and head poses have to be estimated, and whatever error is in that estimate lands directly in your policy's training distribution as label noise. Retargeting maps an estimated human pose onto a robot embodiment, so a centimeter of hand-pose error is a centimeter of error in the action the policy learns to imitate.

That reframes the problem. **Egocentric capture is a metrology problem before it's a video collection problem.** You need centimeter accuracy under occlusion, motion blur, bad lighting, and across operators — on footage shot in a grocery store, not a lab.

Nobody could buy the stack to do that. So we built it.

## Two things, released together

**RoboCap** is a 250 g hat with six hardware-synchronized global-shutter cameras and two IMUs. It's for sale.

**The Grounded API** is our SLAM, depth estimation, and hand tracking, tuned for RoboCap but device-agnostic. The same binaries run on handheld fisheye rigs, aerial stereo platforms, VR headsets, and research glasses whose cameras barely share a field of view.

That second property isn't a nice-to-have, it's evidence. If our algorithms only worked on our hardware, the benchmark numbers would just mean we overfit to one rig. Running unchanged across rigs is how we show the results reflect general 3D estimation.

## Designing the sensors backward from the math

Most head-worn devices have sensing suites that are byproducts of something else. Smart glasses optimize for display, audio, and how they look on your face. Mixed-reality headsets optimize for rendering. The cameras are there to serve those goals, and 3D estimation gets whatever is left over.

We inverted that. Every sensor on RoboCap traces to a specific requirement of the estimation stack:

- **Depth has to be measured, not inferred.** Monocular metric depth infers scale from learned priors. That's exactly the failure mode the hardware exists to eliminate, so we put in calibrated stereo pairs with baselines wide enough to resolve centimeters at arm's length.
- **Hands have to stay in frustum.** People reach outside the forward cone constantly. Two wide-angle lateral cameras keep hands visible through natural motion and keep the trajectory solver constrained during close-range manipulation.
- **Multi-view fusion is only valid if views are simultaneous.** Every camera fires off one PWM trigger fanned out through a 1-to-6 buffer. Simultaneity holds by construction, not by scheduling. Measured camera-to-camera offset is 0 ms at timestamping granularity.
- **Metric scale is only as good as the calibration underneath it.** Every unit is individually calibrated at the factory, not handed a nominal fleet model.

![Camera coverage](/blogs/robocap/02_camera_coverage.jpg)

*Azimuth coverage of the front stereo and lateral cameras; azimuth coverage of the eye pair; elevation coverage of the front and eye pairs. Overlap figures are the binocular field at infinity from the calibrated extrinsics.*

### Why a hat

We looked at glasses, headsets, and phone rigs. A hat won on three counts. It distributes weight over the crown, so it can carry more sensor and battery than eyewear can without becoming uncomfortable. It needs no display, audio, or interaction hardware, so cost is dominated by cameras and IMUs. And it's socially unobtrusive enough to wear where the data actually is — which is outside a lab.

The result is 250 g, worn for hours without adjustment. It draws 4–6 W, runs about six hours off a 10,000 mAh bank, and records to 210 GB of internal storage (roughly 19 hours) offloaded over USB 3.

One detail we're glad we built: a small onboard cell acts as a fail-safe. If the battery tether gets yanked mid-session, the device stays alive long enough to finalize and save the recording. No session is lost to a power interruption.

## The result we didn't expect: calibration beats model quality

Here's the finding that changed how we think about the whole pipeline.

Factory calibration doesn't survive contact with the world. Mechanical and thermal stress shift the rig slightly, and at manipulation range that's not a second-order effect — one pixel of disparity error is about a centimeter of depth at 0.65 m. Across our fleet, relative rotation between stereo cameras drifts by 0.2–1.1° (median ≈0.5°), producing 1–5 px of epipolar residual and 1–2 cm of depth bias exactly where the hands are.

This isn't unique to us. Aria reports roughly 25 arcmin of instantaneous deformation between its stereo cameras just from the act of taking the glasses off.

![Epipolar residuals before and after self-calibration](/blogs/robocap/03_epipolar_before_after.jpg)

*The same features in left and right cameras, with epipolar lines drawn across each pair. Before self-calibration (top), features sit off their epipolar lines. After (bottom), the drift is almost entirely gone.*

Rather than fight the drift mechanically, we correct it per session. No calibration target, no operator involvement — just natural correspondences from the recording itself. The drift is dominated by rotation, so we hold translations at factory values and adjust only the relative rotation of each stereo pair, fitting against Sampson epipolar distance. Corrections are accepted only if they improve a held-out residual and land within about 1° of that device's own factory value.

![Epipolar drift histograms](/blogs/robocap/04_epipolar_drift_histograms.jpg)

*Drift across 150 deployed devices, for the eye pair, front pair, and front-eye pairs. It's Gaussian and centered on zero, which is why a rotational correction is sufficient.*

Now the part that surprised us. We ran Fast-FoundationStereo on a ChArUco board with ground truth from the board pose — independent of the stereo extrinsics — and compared factory against online calibration:

| Distance | Factory calibration | Online calibration |
|---|---|---|
| < 0.8 m | 0.023 | 0.011 |
| ≥ 0.8 m | 0.029 | 0.016 |
| All | 0.025 | 0.012 |

*Depth AbsRel, 1,277 frames, 106,602 corners, same frames for both.*

**Online calibration halves depth error within reach.** Across 150 devices, factory calibration leaves a median front-pair epipolar residual of 3.8 px; online calibration brings it to 0.56 px. Switching changes in-reach depth by a median 3.6% per device, 11% at the 90th percentile, and moves 31% of in-reach pixels by more than 5%.

![Depth with factory vs online calibration](/blogs/robocap/06_depth_factory_vs_online.jpg)

*The insidious part: factory-calibrated depth maps look fine. They're sharp and complete — just systematically wrong in scale and shape. Without ground truth you would never see it.*

That last point is the one we'd underline. A bad calibration doesn't produce obviously broken depth. It produces confident, clean, wrong depth. If you're building on egocentric data and not measuring calibration drift, you may be training on distortion you can't see.

Meanwhile, the model itself was not the bottleneck. On UnrealEgo2, Fast-FoundationStereo hits 0.016 AbsRel on surfaces both cameras see at 0.3–1.0 m — at the benchmark's own 2 cm quantization limit, and on par with full FoundationStereo at a fraction of the inference cost.

| Pixels | % px | FFS AbsRel ↓ | FFS δ1.25 ↑ | FS AbsRel ↓ | FS δ1.25 ↑ |
|---|---|---|---|---|---|
| All | 100.0 | 0.455 | 69.7 | 0.278 | 75.5 |
| Visible in both views | 11.8 | 0.016 | 99.6 | 0.015 | 99.7 |
| Visible in one view | 26.8 | 0.297 | 61.2 | 0.171 | 77.8 |

Zero-shot models are already accurate enough. Calibration is what's limiting you on deployed hardware.

## SLAM: state of the art across every benchmark mean

Our visual-inertial SLAM joins three published designs — a CUDA feature frontend, a keyframe-graph inertial estimator, and established place recognition — each ported with its published constants.

All cameras feed one estimator. The front stereo pair fixes scale; cameras without an overlapping partner carry their own landmarks through a monocular-inertial depth filter, so the lateral views keep the solver constrained during close-range manipulation. Landmarks get an identity that outlives the track, so revisits can re-bind them. A verified loop closure re-enters as observations rather than a pose-graph edge, letting the solver that produced the drift correct it with its own covariances.

| Benchmark | ORB-SLAM3 | Basalt | OKVIS2 | cuVSLAM | **Ours** |
|---|---|---|---|---|---|
| EuRoC | 3.5 / 3.3 | 5.8 / 5.5 | 3.1 / 2.3 | 6.6 / 8.4 | **2.4 / 2.0** |
| TUM-VI | 20.1 / 9.5 | 31.6 / 34.5 | 12.8 / 3.5 | 29.6 / 91.2 | **10.0 / 4.0** |
| VECtor | 12.6 / 18.3 | 28.0 / 71.1 | 24.6 / 19.9 | 16.5 / 36.0 | **6.0 / 2.5** |
| Monado | – / 2.5 | – / 11.2 | – / 2.2 | 11.5 / 11.5 | **2.3 / 1.9** |
| ADT | 2.1 / 1.7 | 11.2 / 6.5 | – | 15.9 / 6.9 | **1.5 / 1.4** |
| HOT3D | – | 4.5 / 4.7 | – | 46.9 / 55.4 | **0.4 / 0.3** |

*Offline ATE RMSE in cm, mean / median across sequences. One configuration, all provided cameras, no per-dataset tuning. Published numbers where they exist, otherwise the released code with its published configuration on identical inputs.*

We lead every benchmark on mean and all but TUM-VI on median: ahead of OKVIS2 on EuRoC and TUM-VI with fewer failures, at half the best baseline's error on VECtor and Monado, and on the Aria sets within the noise of the pseudo-ground truth itself.

![Scene reconstruction](/blogs/robocap/05_scene_reconstruction.jpg)

*Four RoboCap sessions: point clouds projected into a gravity-aligned world frame, with multi-session alignment solved by RANSAC on 3D-projected SIFT features.*

## Hand tracking without motion capture

This is the part with the most leverage for the field.

Every existing hand-pose corpus derives its ground truth from a motion-capture installation or a closed on-device tracker. That means annotation cost scales with instrumentation rather than with compute, and collection is confined to instrumented space. One recent effort addressed this by building a large exoskeleton cage — which tells you how binding the constraint is.

But the difficulty in hand tracking is in-the-wild. Metric accuracy has to survive occlusion, motion blur, gloves, bad lighting, and operator diversity. Those are precisely the conditions a mocap studio doesn't have.

So we generate labels without motion capture. We bootstrap monocular priors into a multi-view hand reconstruction model, then fit a single MANO parameterization through differentiable refinement that optimizes for reprojected appearance and naturalness across the whole trajectory. The tracking model itself is a feed-forward multi-view ViT that consumes raw crops and camera parameters and predicts one hand pose across all views — multi-view consistency by construction, rather than triangulating inconsistent monocular guesses.

![Hand tracking robustness](/blogs/robocap/07_hand_tracking_robustness.jpg)

*Motion blur, visual ambiguity, complex poses, gloves, occlusion, and lighting — the cases that break lab-trained models.*

Does the in-the-wild pretraining actually help? We fine-tuned the same architecture for 10k steps on three public egocentric datasets spanning three headset types with different camera counts, placements, and optics — varying only the initialization:

| Dataset | From scratch | **Pretrained** |
|---|---|---|
| HOT3D | 17.41 | **14.47** |
| UmeTrack | 19.00 | **11.49** |
| SHOW3D | 19.34 | **13.68** |

*MPJPE in mm after 10k fine-tuning steps.*

Pretraining cuts error on all three by 2.9 to 7.5 mm, or 17–40%. These are rigs unlike the one we pretrained on, which is the point: labels generated without motion capture transfer better than labels generated with it.

Against POEMv2 on third-person multi-view benchmarks, we win on DexYCB (5.51 vs 6.69) and OakInk (7.35 vs 8.34). We lose on HO3D (15.64 vs 7.72), where 2 of 5 cameras are dropped in the evaluation sequences and our single-rig-trained model doesn't adapt without more fine-tuning. We'd rather show you that number than omit it.

## What this doesn't answer

The device makes a bet. Designing the sensing suite backward from metric estimation buys precision at manipulation range, but it fixes the geometry: the working volume is set by the stereo baselines and lateral coverage, and reaches that leave every frustum aren't recoverable. It assumes a tethered battery bank, which suits deliberate collection and not ambient all-day wear.

Our SLAM struggles on long, self-similar loops where too few revisits are recognized to correct accumulated drift — something Aria's SLAM handles well.

And the honest limitation: **this report establishes precision, not its downstream effect on policy performance.** We argue label error enters a policy's training distribution as noise, and prior work supports the link, but we have not measured how much downstream performance a centimeter buys. That requires training policies at scale on data this stack produces. It's what we're working on now.

## Available today

Both the device and the API are available now. We expect the field to find failure modes we haven't, and we'd like to hear about them.

[Buy a RoboCap](https://robocap.io) · [Read the technical report](/blogs/robocap/robocap-technical-report.pdf) · [API docs](https://app.gsi.company)
