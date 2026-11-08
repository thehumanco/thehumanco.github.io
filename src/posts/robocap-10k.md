---
title: RoboCap-10k
date: November 2026
order: 5
author: Vincent Liu, Ademi Adeniji
description: A new standard for egocentric robot data: 10,000 hours of real work, with metric 3D action labels
unrelease: false
---

<video class="launch" controls autoplay muted loop playsinline preload="auto" poster="/blogs/robocap-10k/teaser.jpg">
  <source src="/blogs/robocap-10k/teaser.mp4" type="video/mp4">
</video>

<p class="paper-link"><a href="/blogs/robocap-10k/robocap_10k_a_metrically_accurate_egocentric_dataset_for_robot_learning.pdf">Read the technical report (PDF)</a><span class="sep"> · </span><a href="https://huggingface.co/datasets/groundedsi/RoboCap-10k">Download the dataset</a></p>

Egocentric video is the most scalable source of manipulation data for robot learning, but video alone is not supervision. A robot imitates poses, not pixels, so every hour of footage becomes useful only once someone estimates where the head and hands were, in meters, at every frame. The largest egocentric corpora today are monocular, where metric scale can only be guessed from learned priors. The most accurate ones are captured in motion-capture labs with a handful of participants. Federated efforts pool heterogeneous devices and inherit their differences, and headset-labeled datasets inherit whatever a real-time tracker produced, with no raw multi-view data to re-estimate from.

Today we are releasing **RoboCap-10k**: 10,000 curated hours of unscripted, bimanual manipulation, recorded by workers during their paid shifts in 11 countries, across 21 industry verticals, 365 workplace types, and 619 distinct tasks. Every hour was captured on one device, the [RoboCap](/blogs/the-robocap-for-robot-learning), and processed by one 3D stack, the [Grounded API](https://app.gsi.company). Every frame carries a gravity-aligned 6-DoF head pose and world-frame MANO hand poses, and every episode carries two tiers of language. We release the raw synchronized streams alongside the labels, so they can be audited, and regenerated as methods improve.

## Real, in-the-wild, occupational work

Most egocentric datasets record household chores or tabletop tasks performed for the camera. RoboCap-10k records occupational work: bread and pastry production, industrial garment stitching, engine and motorcycle repair, circuit-board soldering, rebar tying, onion harvesting. Wearers are existing employees recording during their regular 6–12 hour shifts; the hat is the only change to their work, and nothing is scripted, staged, or repeated for the camera. Policies degrade sharply under visual shift, so the clutter, lighting, and tools of each workplace are left exactly as they are.

These are curated hours, not raw recording time. An episode is one continuous clip in which a person performs one recognizable task with both hands tracked and SLAM available, and it is kept only if it passes calibration, SLAM, and hand-tracking checks. The corpus holds 1,363,915 episodes, with a median length of 17.8 s, about a billion synchronized timesteps, and 6.5 billion camera frames across six streams.

<figure class="figures">
  <img src="/blogs/robocap-10k/03_corpus_stats.jpg" alt="Released hours by country and episode length distribution">
  <figcaption>Corpus statistics. Left: share of released hours by country. Right: share of episodes by length in 2 s bins; episodes longer than 120 s are grouped in the final bar.</figcaption>
</figure>

Every task is labeled with the industry vertical it was recorded in and, independently, the skill group it requires, and is rated by difficulty. Easy tasks are single-step and need no training, like sorting groundnuts. Medium tasks need coordination or planning, like shaping dough into loaves. Hard tasks are skilled work that takes training or expertise, like soldering components onto PCB panels, weaving cane onto chair frames, or stitching garments on industrial machines; 172 of the 619 tasks are hard. The distribution is long-tailed by design, and because one label often covers several workflows, these counts are a floor on the true variety.

<figure class="figures">
  <img src="/blogs/robocap-10k/04_taxonomy.jpg" alt="Distinct tasks per industry vertical and per skill group">
  <figcaption>RoboCap-10k taxonomy. Left: distinct tasks per industry vertical. Right: share of distinct tasks per skill group. Both are broken down by difficulty.</figcaption>
</figure>

## Action labels with sub-centimeter precision

Head trajectories come from the Grounded API's multi-camera visual-inertial SLAM, refined offline with a keyframe bundle adjustment over the whole session once every revisit is known. Hand poses come from a feed-forward multi-view tracker that takes crops from every camera that sees a hand and predicts a single MANO pose consistent across views by construction. It holds up through gloves, tool contact, partial occlusion, clutter, and outdoor light.

<figure class="figures">
  <img src="/blogs/robocap-10k/02_hands.jpg" alt="Estimated hand meshes rendered over egocentric frames from nine workplaces">
  <figcaption>Hand pose estimates across workplaces, with the estimated MANO meshes rendered over the image (blue: left hand, magenta: right hand).</figcaption>
</figure>

We evaluate both against optical motion capture on RoboMoCap, recorded on the RoboCap itself. Over 153.4 hours and 4,669 trajectories, head pose reaches a median absolute trajectory error of 3.0 mm, with metric scale recovered to a median 0.17% without any scale alignment. On held-out test sequences, hands reach 4.5 mm PA-MPJPE over 21 keypoints. On the city-scale LaMAria benchmark, our SLAM scores 72.4, close to Aria's own SLAM at 75.9.

<figure class="figures">
  <div class="figure-table">
    <table>
      <thead>
        <tr><th>Label</th><th>Benchmark</th><th>Metric</th><th>Result</th></tr>
      </thead>
      <tbody>
        <tr><td>Head pose</td><td>RoboMoCap, 153.4 h</td><td>Median ATE</td><td>3.0 mm</td></tr>
        <tr><td>Hand pose</td><td>RoboMoCap, held-out</td><td>PA-MPJPE</td><td>4.5 mm</td></tr>
        <tr><td>Head pose</td><td>LaMAria, 27.5 h</td><td>Control-point score</td><td>72.4</td></tr>
        <tr><td>Calibration</td><td>All 216 devices</td><td>Median Sampson error</td><td>0.63 px</td></tr>
      </tbody>
    </table>
  </div>
  <figcaption>Annotation accuracy. Head and hand poses are evaluated against optical motion capture; LaMAria scores against surveyed control points.</figcaption>
</figure>

## Standardized hardware, calibrated online

Because every hour comes from the same hardware design, there is no cross-device domain shift in either the imagery or the quality of the 3D labels. The RoboCap is a 250 g hat with six hardware-synchronized global-shutter cameras: two fisheye stereo pairs that keep the hands inside a metric stereo frustum across the reach envelope, and two lateral wide-angle cameras that catch reaches leaving it. Two IMUs at 200 Hz share the cameras' clock.

Factory calibration is where accuracy starts, not where it ends. Wearable rigs deform under mechanical and thermal stress, and across our fleet the rotation between stereo cameras drifts by about half a degree, enough for a 1–2 cm depth bias at manipulation range. So for every recording session we re-estimate the rotations of all six cameras jointly from natural correspondences in the footage, holding the factory translations fixed so metric scale stays anchored. Across the release, every one of the 216 devices averages below 1 px of epipolar error, with a median of 0.63 px on the front pair and 0.60 px on the eye pair. Two devices that could not get below 1 px were excluded, removing 34 hours.

<figure class="figures">
  <img src="/blogs/robocap-10k/05_calibration.jpg" alt="Per-device calibration error after online calibration">
  <figcaption>Calibration error per device after online calibration. Held-out Sampson error of each of the 216 devices in the release. Dashed lines mark the median; dotted lines mark 1 px.</figcaption>
</figure>

## Task and subtask captioning

Manipulation at work is long-horizon, so every interval carries one free-text sparse caption describing its overall intent, and is cut into consecutive dense units describing what happens at each moment. Each dense unit records the scene, the sub-task it belongs to, and the physical action, which together supervise both task planning and short-horizon control. The two tiers are generated independently, and captions for 1,000 hours were reviewed by people against the source video.

<figure class="figures">
  <div class="figure-table">
    <table>
      <thead>
        <tr><th>Tier</th><th>Span</th><th>Caption</th></tr>
      </thead>
      <tbody>
        <tr><td>Sparse</td><td>0.0–14.8 s</td><td>Tears a piece of paper towel from a roll, folds it, and wipes a glass beaker.</td></tr>
        <tr><td>Dense</td><td>0.0–3.5 s</td><td>Tears a section of paper towel from the roll.</td></tr>
        <tr><td>Dense</td><td>3.5–9.5 s</td><td>Folds the torn paper towel sheet.</td></tr>
        <tr><td>Dense</td><td>9.5–14.8 s</td><td>Wipes the interior of a small clear container with the folded paper.</td></tr>
      </tbody>
    </table>
  </div>
  <figcaption>The two caption tiers on one interval. One sparse caption describes the whole clip; dense units split it into consecutive actions.</figcaption>
</figure>

## A new standard for egocentric data

RoboCap-10k is the only released dataset that combines calibrated stereo, metric head pose, and 3D hands with more than 10,000 hours of occupational work.

<figure class="figures">
  <div class="figure-table">
    <table>
      <thead>
        <tr><th>Dataset</th><th>Hours</th><th>Single device</th><th>Calibrated stereo</th><th>Metric head</th><th>3D hands</th><th>Occupational</th></tr>
      </thead>
      <tbody>
        <tr><td>Ego4D</td><td>3,670</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td></tr>
        <tr><td>Ego-Exo4D</td><td>221</td><td>✓</td><td>✗</td><td>✓</td><td>✗</td><td>✗</td></tr>
        <tr><td>EgoDex</td><td>829</td><td>✓</td><td>✗</td><td>✓</td><td>✓</td><td>✗</td></tr>
        <tr><td>EgoVerse</td><td>1,362</td><td>✗</td><td>✗</td><td>✓</td><td>✓</td><td>✗</td></tr>
        <tr><td>EgoLive</td><td>1,680</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
        <tr><td>Xperience-10M</td><td>10,000</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
        <tr><td>EgoSuite-Open100K</td><td>10,000</td><td>✗</td><td>✗</td><td>✗</td><td>✓</td><td>✗</td></tr>
        <tr><td>Egocentric-10K</td><td>10,000</td><td>✓</td><td>✗</td><td>✗</td><td>✗</td><td>✓</td></tr>
        <tr><td><strong>RoboCap-10k</strong></td><td><strong>10,000</strong></td><td><strong>✓</strong></td><td><strong>✓</strong></td><td><strong>✓</strong></td><td><strong>✓</strong></td><td><strong>✓</strong></td></tr>
      </tbody>
    </table>
  </div>
  <figcaption>Comparison with egocentric datasets used for manipulation learning. A property is marked only if it holds for, and is reported across, the full released dataset. Hours count publicly released egocentric footage as of November 2026; the technical report lists more datasets.</figcaption>
</figure>

## Ready to train, safe to share

Every episode ships in two formats. The LeRobot format is for training: each camera is an H.265 MP4, and per-frame head pose, MANO parameters and keypoints for both hands, and IMU readings are stored in Parquet tables indexed by frame, so the corpus drops into existing dataloaders. A Rerun recording of the same episode is for inspection, placing the six streams, head trajectory, and hand meshes in one 3D world frame on a common timeline. Each episode also carries its factory and online-corrected calibration and a JSON sidecar with taxonomy labels, captions, and per-session quality statistics. The dataset is released under CC BY 4.0, open to research and commercial use alike.

Every operator signed an informed consent form, every partner enterprise signed a data agreement, and wearers are compensated on top of their wages. No audio is recorded, and released metadata identifies only the country and site type. Off-the-shelf face detectors miss many faces in this footage, seen from above, through fisheye optics, at the distorted periphery, so we trained our own on roughly 1,000 hours of labeled RoboCap footage. At the released operating point it recalls 77.3% of faces at 92.4% precision, against 25.1% for RetinaFace, and detections are tracked and propagated across frames so a face missed in one frame is still covered by its neighbors. Blurring is irreversible; the originals are not distributed.

We release RoboCap-10k as pretraining data for generalist manipulation policies and world models, and as a testbed for a question the field has not yet answered: how much does the precision of human action labels matter at scale?
