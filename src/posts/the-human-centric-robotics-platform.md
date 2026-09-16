---
title: The Human-Centric Robotics Platform
date: September 2026
order: 3
author: Ademi Adeniji, Vincent Liu
description: Announcing the platform for human-centric robotics, RoboCap, and our Grounded API
unrelease: false
---

<video class="launch" controls autoplay muted playsinline preload="auto" poster="/blogs/human-centric/launch-poster.jpg">
  <source src="/blogs/human-centric/launch.webm" type="video/webm">
  <source src="/blogs/human-centric/launch.mp4" type="video/mp4">
</video>

<p class="paper-link"><a href="https://robocap.io">Buy a RoboCap</a><span class="sep">·</span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>

Action is older than language. Billions of years ago, our earliest biological predecessors had no language and no thoughts, but they moved, sensed, and changed their surroundings. In fact, grasping isn’t specific to humans or even primates. Evolution invented the grasp many times over: cephalopods with boneless arms, birds with talons, elephants with trunks, and primates with hands.

The defining feature in primates is the hand. In humans, manipulation capabilities leapt ahead even though our hands are mechanically similar to those of our primate ancestors. Only the *homo sapiens* can thread a needle, play the violin, and twirl a pen. It turns out that evolution made our hands “intelligent.” Our hands, which only comprise 2% of our body’s surface area, are ⅓ of our primary motor cortex. Our dexterity is the hallmark of all physical intelligence.

The goal of generalist robotics is to achieve and transcend human-level physical intelligence. In other domains, AI has begun to achieve human-level capabilities by relying on massive pretraining corpora. However, despite manipulation being one of biology’s oldest behaviors, we are still missing an Internet-scale pretraining corpus to learn it.

Today, Grounded Superintelligence (GSI) is emerging from stealth to announce the platform for human-centric robotics. Humans are the most abundant source of manipulation data in the world today, and so we’ve built our system around capturing it as accurately as possible. What the keyboard and personal computing were for humanity’s language, we have built for its dexterity.

GSI is a team of full-stack roboticists who believe that great data is the foundation of all success in robotics. The first product we’re releasing is [Grounded API](https://app.gsi.company) built on the RoboCap suite. The RoboCap suite includes an ergonomic 6-camera cap and two wrist cameras all wirelessly synchronized. Grounded API is a self-serve application providing state-of-the-art 3D computer vision models to perform SLAM, depth estimation, and hand tracking at the click of a mouse. For the first time, anyone can cheaply record and convert raw data into high-quality training tokens for robotics.

GSI’s models are state-of-the-art: our multi-view hand tracking is pretrained on a proprietary pretraining corpus that tops all of Meta's released datasets. Our GPU-accelerated SLAM beats the widely-used ORB-SLAM3 and NVIDIA's cuVSLAM on [several public benchmarks](https://www.gsi.company/blogs/the-robocap-for-robot-learning). Both achieve sub-1cm accuracy on data from the RoboCap device. We are now ramping up mass manufacturing and deployment of RoboCap and RoboWrist with our partners. 

Robotics is following the trajectory of language models where massive pre-training unlocks baseline generalist capabilities, and targeted post-training solves the long tail. We believe that human data can supply both the large-scale diversity for pre-training and the domain-specific data from real-world deployment settings for post-training.

**How to Work With Us**

- If you are a **Data Vendor**: Deploy our hardware across your industrial network. We’ve distributed 10,000+ devices to vendors supplying scale data to frontier AI labs.
- If you are a **Business Owner**: Monetize your workforce's daily actions without disrupting operations. We’re already partnering with global staffing platforms like Job&Talent—staffing millions across Fortune 500 companies—to transform raw operational data into valuable robot policy tokens.
- If you are a **Researcher**: Collect high-fidelity, benchmark-grade hand manipulation data for your own controlled human-to-robot learning experiments.

If you are a lab, please get in touch at [hello@gsi.company](mailto:hello@gsi.company) to access enriched datasets from Robocap deployed in-the-wild at massive scale.
We are excited to enable everyone to participate in the next generation of robotics foundation models.

Sincerely,

Ademi & Vincent

<p class="paper-link"><a href="https://robocap.io">Buy a RoboCap</a><span class="sep">·</span><a href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</a></p>
