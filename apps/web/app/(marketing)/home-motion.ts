// Homepage motion: Lenis smooth scroll + GSAP, ported from design/homepage/motion.js.
// It finds elements by their copy, so the generated markup can be re-exported from Stitch
// as long as the text stays the same. Returns a cleanup function for React.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

type El = HTMLElement;

export function startHomeMotion(root: El): () => void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  gsap.registerPlugin(ScrollTrigger);

  const timers: ReturnType<typeof setInterval>[] = [];
  const every = (fn: () => void, ms: number) => timers.push(setInterval(fn, ms));
  const byText = (text: string, scope: Node = root) =>
    document.evaluate(`.//*[normalize-space(text())=${JSON.stringify(text)}]`, scope, null, 9, null)
      .singleNodeValue as El | null;
  const ancestorContaining = (node: El, other: El) => {
    let el: El | null = node;
    while (el && !el.contains(other)) el = el.parentElement;
    return el;
  };
  /** Runs `start` while `el` is on screen and `stop` when it leaves, so loops don't burn CPU off-screen. */
  const whileVisible = (el: El, start: () => void, stop: () => void) =>
    ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onToggle: (s) => (s.isActive ? start() : stop()),
    });
  const loop = (fn: () => void, ms: number) => {
    let id: ReturnType<typeof setInterval> | null = null;
    return {
      start: () => {
        if (!id) id = setInterval(fn, ms);
      },
      stop: () => {
        if (id) clearInterval(id);
        id = null;
      },
    };
  };
  const loops: ReturnType<typeof loop>[] = [];
  const restores: (() => void)[] = []; // undo text the motion rewrites (React dev runs effects twice)

  // ---------- smooth scroll ----------
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  const raf = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  const onAnchorClick = (e: MouseEvent) => {
    const a = (e.target as El).closest<HTMLAnchorElement>('a[href^="#"]');
    const href = a?.getAttribute("href");
    const target = href && href.length > 1 ? root.querySelector<El>(href) : null;
    if (target) {
      e.preventDefault();
      lenis.scrollTo(target, { offset: -90 });
    }
  };
  root.addEventListener("click", onAnchorClick);

  const ctx = gsap.context(() => {
    // ---------- navbar ----------
    const nav = root.querySelector<El>("header nav");
    if (nav) {
      nav.classList.add("cw-nav");
      ScrollTrigger.create({ start: 40, onUpdate: (s) => nav.classList.toggle("cw-nav-scrolled", s.scroll() > 40) });
      gsap.from(nav, { y: -30, opacity: 0, duration: 0.8, ease: "power3.out" });
    }

    // ---------- hero ----------
    const hero = root.querySelector("header")?.nextElementSibling as El | null;
    const h1 = hero?.querySelector("h1");
    if (hero && h1?.parentElement) {
      gsap.from(h1.parentElement.children, {
        y: 32,
        opacity: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: "power3.out",
        delay: 0.1,
      });
    }

    // Cycling word: Reels -> Shorts -> TikToks, pill resizes to fit.
    const pill = root.querySelector<El>("#cycle-word");
    if (pill) {
      const words = ["Reels", "Shorts", "TikToks"];
      let i = 0;
      pill.innerHTML = `<span class="cw-w">${words[0]}</span>`;
      every(() => {
        i = (i + 1) % words.length;
        const from = pill.offsetWidth;
        const old = pill.querySelector<El>(".cw-w");
        if (!old) return;
        gsap.to(old, {
          yPercent: -110,
          opacity: 0,
          duration: 0.35,
          ease: "power2.in",
          onComplete: () => {
            old.textContent = words[i] ?? "";
            pill.style.width = "auto";
            const to = pill.offsetWidth;
            pill.style.width = `${from}px`;
            gsap.to(pill, {
              width: to,
              duration: 0.45,
              ease: "power3.out",
              onComplete: () => {
                pill.style.width = "auto";
              },
            });
            gsap.fromTo(
              old,
              { yPercent: 110, opacity: 0 },
              { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
            );
          },
        });
      }, 2400);
    }

    // Phone + floating UI fragments.
    const lines = hero?.querySelector("svg line")?.closest("svg") as El | null | undefined;
    const rightCol = lines?.parentElement;
    if (hero && lines && rightCol) {
      const kids = [...rightCol.children] as El[];
      const phone = kids.find((k) => k.textContent?.includes("LIVE PREVIEW"));
      const cards = kids.filter((k) => k !== phone && k !== lines);
      if (phone) {
        gsap.from(phone, { y: 70, opacity: 0, scale: 0.94, duration: 1.1, ease: "power3.out", delay: 0.25 });
        gsap.to(phone, { y: -6, duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.3 });
      }
      gsap.from(cards, { scale: 0.85, opacity: 0, duration: 0.7, stagger: 0.1, ease: "back.out(1.6)", delay: 0.6 });
      gsap.from(lines, { opacity: 0, duration: 1, delay: 1.1 });
      cards.forEach((c, n) => {
        gsap.to(c, {
          y: n % 2 ? 8 : -8,
          duration: 2.4 + n * 0.35,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: 1.2,
        });
      });
      // Parallax: the composition drifts up slower than the page.
      gsap.to(rightCol, {
        yPercent: -8,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });

      if (phone) {
        // Phone captions cycle, one word highlighted.
        const capP = [...phone.querySelectorAll("p")].find((p) => p.textContent?.includes("Engineered for"));
        const hl = capP?.querySelector("span");
        if (capP && hl) {
          const hlClass = hl.className;
          const caps = [
            ["Engineered for", "momentum"],
            ["Made to be", "watched"],
            ["Ideas in,", "videos out"],
          ] as const;
          let c = 0;
          every(() => {
            c = (c + 1) % caps.length;
            gsap.to(capP, {
              opacity: 0,
              y: 6,
              duration: 0.25,
              onComplete: () => {
                const [lead, word] = caps[c] ?? caps[0];
                capP.innerHTML = `${lead} <span class="${hlClass}">${word}</span>`;
                gsap.to(capP, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
              },
            });
          }, 2600);
        }

        // Phone timecode ticks.
        const tc = byText("00:03.20", phone);
        if (tc) {
          const t = { s: 0 };
          gsap.to(t, {
            s: 15,
            duration: 15,
            ease: "none",
            repeat: -1,
            onUpdate: () => {
              tc.textContent = `00:${String(Math.floor(t.s)).padStart(2, "0")}.${String(Math.floor((t.s % 1) * 100)).padStart(2, "0")}`;
            },
          });
        }
      }

      // Render progress card loops 0 -> 100%.
      const bar = rightCol.querySelector<El>('[style*="width: 72%"], [style*="width:72%"]');
      const pct = byText("72%", rightCol);
      if (bar && pct) {
        const p = { v: 0 };
        gsap.to(p, {
          v: 100,
          duration: 4.5,
          ease: "power1.inOut",
          repeat: -1,
          repeatDelay: 1.2,
          onUpdate: () => {
            bar.style.width = `${p.v}%`;
            pct.textContent = `${Math.round(p.v)}%`;
          },
        });
      }

      // Voice waveform bars bounce.
      const voiceCard = cards.find((c) => c.textContent?.includes("Voice: Liam"));
      const bars = voiceCard ? ([...voiceCard.children].at(-1)?.children ?? null) : null;
      if (bars) {
        [...bars].forEach((b, n) => {
          gsap.to(b, {
            scaleY: 0.35,
            transformOrigin: "50% 50%",
            duration: 0.35 + (n % 4) * 0.12,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            delay: n * 0.05,
          });
        });
      }
    }

    // ---------- how it works ----------
    const how = root.querySelector<El>("#how-it-works");
    const panel = how?.lastElementChild as El | null;
    if (how && panel) {
      gsap.from(how.firstElementChild, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: how, start: "top 80%" },
      });
      gsap.from(panel, {
        y: 60,
        opacity: 0,
        scale: 0.98,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: how, start: "top 75%" },
      });

      // Prompt types itself once.
      const prompt = [...how.querySelectorAll("p")].find((p) => p.textContent?.includes("Launch video for our new"));
      const textNode = prompt && [...prompt.childNodes].find((n) => n.nodeType === 3 && n.textContent?.trim());
      if (textNode) {
        const original = textNode.textContent ?? "";
        const full = original.trim();
        textNode.textContent = "";
        restores.push(() => {
          textNode.textContent = original;
        });
        const t = { n: 0 };
        gsap.to(t, {
          n: full.length,
          duration: full.length * 0.022,
          ease: "none",
          scrollTrigger: { trigger: panel, start: "top 70%" },
          onUpdate: () => {
            textNode.textContent = `${full.slice(0, Math.round(t.n))} `;
          },
        });
      }

      // Playhead sweeps the 30s timeline; scenes, caption chips and stage pills follow it.
      const label = byText("00:11.40", panel);
      const playhead = label?.parentElement;
      const lane = playhead?.parentElement;
      const clock = byText("00:11.40 / 00:30.00", panel);
      const scenes = ["Hook", "Feature", "Proof", "Offer CTA"].map((w) => byText(w, panel)?.parentElement);
      const ranges = [
        [0, 3],
        [3, 11],
        [11, 20],
        [20, 30],
      ] as const;
      const chipWords = ["Featherweight", "propulsion", "under", "your", "feet"].map((w) => byText(w, panel));
      const onChip = chipWords[1]?.className ?? "";
      const offChip = chipWords[0]?.className ?? "";
      const stages = ["01 Write", "02 Build", "03 Post"].map((w) => byText(w, how));
      const onStage = stages[0]?.className ?? "";
      const offStage = stages[1]?.className ?? "";
      if (label && playhead && lane) {
        const fmt = (s: number) =>
          `00:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.floor((s % 1) * 100)).padStart(2, "0")}`;
        const t = { s: 0 };
        const sweep = gsap.to(t, {
          s: 30,
          duration: 12,
          ease: "none",
          repeat: -1,
          paused: true,
          onUpdate: () => {
            playhead.style.left = `${(t.s / 30) * 100}%`;
            label.textContent = fmt(t.s);
            if (clock) clock.textContent = `${fmt(t.s)} / 00:30.00`;
            scenes.forEach((el, k) => {
              const [a, b] = ranges[k] ?? [0, 0];
              if (el) el.style.boxShadow = t.s >= a && t.s < b ? "0 0 0 2px #C6F432" : "";
            });
            const ci = Math.min(chipWords.length - 1, Math.floor(t.s / 6));
            chipWords.forEach((el, k) => {
              if (el) el.className = k === ci ? onChip : offChip;
            });
            const si = Math.min(2, Math.floor(t.s / 10));
            stages.forEach((el, k) => {
              if (el) el.className = k === si ? onStage : offStage;
            });
          },
        });
        whileVisible(
          panel,
          () => sweep.play(),
          () => sweep.pause(),
        );
      }
    }

    // ---------- formats ----------
    const styles = root.querySelector<El>("#styles");
    if (styles) {
      gsap.from(styles.firstElementChild, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: styles, start: "top 80%" },
      });
      const names = ["Product promos", "Explainers", "Stories", "Top tips", "News recaps", "Quotes"];
      const spans = names.map((n) => byText(n, styles));
      const arrows = spans.map((s) => s?.previousElementSibling as El | null | undefined);
      const desc = spans[0]?.parentElement?.nextElementSibling as El | null | undefined;
      const onSpan = spans[0]?.className ?? "";
      const offSpan = spans[1]?.className ?? "";
      const onArrow = arrows[0]?.className ?? "";
      const offArrow = arrows[1]?.className ?? "";
      const descs = [
        "High-energy cuts, price badges, spec overlays and a clear call to action.",
        "One idea per scene, animated diagrams and fact-checked numbers.",
        "Slow build, cliffhanger hooks and captions that keep people watching.",
        "Snappy numbered lists made to be saved and shared.",
        "The week's biggest updates, summed up in under a minute.",
        "Big type, calm pacing and your brand on every frame.",
      ];
      const formats = [
        [
          "FORMAT · PRODUCT PROMO",
          "Fast cuts",
          "-30% EARLY BIRD",
          "NEW DROP",
          "Velocity Phantom X",
          "$189",
          "$270",
          "Free shipping",
          "Scene duration: 4.8s",
          "Transition: Snap",
          "Voice: Liam",
        ],
        [
          "FORMAT · EXPLAINER",
          "Clear steps",
          "FACT-CHECKED",
          "SCIENCE IN 60",
          "How GPS finds you",
          "4",
          "",
          "satellites needed",
          "Scene duration: 6s",
          "Transition: Fade",
          "Voice: George",
        ],
        [
          "FORMAT · STORYTIME",
          "Slow build",
          "PART 1",
          "TRUE STORY",
          "The day I lost my passport",
          "3 AM",
          "",
          "Tokyo station",
          "Scene duration: 7s",
          "Transition: Push",
          "Voice: Jessica",
        ],
        [
          "FORMAT · TOP TIPS",
          "Snappy list",
          "SAVE THIS",
          "TOP 5",
          "Sleep better tonight",
          "#1",
          "",
          "No screens after 10",
          "Scene duration: 5s",
          "Transition: Slide",
          "Voice: Liam",
        ],
        [
          "FORMAT · NEWS RECAP",
          "Quick facts",
          "THIS WEEK",
          "RECAP",
          "This week in 60 seconds",
          "3",
          "",
          "big updates",
          "Scene duration: 6s",
          "Transition: Cut",
          "Voice: Jessica",
        ],
        [
          "FORMAT · QUOTE",
          "Calm pacing",
          "DAILY",
          "MONDAY MOTIVATION",
          "Small steps, every day.",
          "",
          "",
          "Share-ready",
          "Scene duration: 8s",
          "Transition: Fade",
          "Voice: George",
        ],
      ];
      const slots = (formats[0] ?? []).map((txt) => byText(txt, styles));
      const card = slots[0] && slots[9] ? ancestorContaining(slots[0], slots[9]) : null;
      const preview = card?.parentElement;
      let active = 0;
      const setActive = (k: number) => {
        if (k === active || !card) return;
        spans.forEach((s, j) => {
          if (s) s.className = j === k ? onSpan : offSpan;
        });
        arrows.forEach((a, j) => {
          if (a) a.className = j === k ? onArrow : offArrow;
        });
        const row = spans[k]?.parentElement;
        if (desc && row) {
          row.after(desc);
          desc.textContent = descs[k] ?? "";
          gsap.fromTo(desc, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.35 });
        }
        gsap.to(card, {
          opacity: 0,
          y: 12,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            slots.forEach((el, j) => {
              if (!el) return;
              const txt = formats[k]?.[j] ?? "";
              el.textContent = txt;
              el.style.visibility = txt ? "" : "hidden";
            });
            gsap.to(card, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
          },
        });
        active = k;
      };
      let paused = false;
      let resume: ReturnType<typeof setTimeout> | undefined;
      spans.forEach((s, k) => {
        const row = s?.parentElement;
        if (!row) return;
        row.style.cursor = "pointer";
        row.addEventListener("mouseenter", () => {
          paused = true;
          clearTimeout(resume);
          setActive(k);
        });
        row.addEventListener("mouseleave", () => {
          resume = setTimeout(() => {
            paused = false;
          }, 4000);
        });
      });
      const auto = loop(() => {
        if (!paused) setActive((active + 1) % formats.length);
      }, 3200);
      loops.push(auto);
      whileVisible(styles, auto.start, auto.stop);
      if (card && preview) {
        const [shape1, shape2] = [...card.children];
        if (shape1) gsap.to(shape1, { rotation: 12, y: -10, duration: 4, yoyo: true, repeat: -1, ease: "sine.inOut" });
        if (shape2) gsap.to(shape2, { scale: 1.08, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
        gsap.from(preview, {
          x: 60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: styles, start: "top 70%" },
        });
      }
      gsap.from(spans.map((s) => s?.parentElement).filter(Boolean), {
        x: -30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.07,
        ease: "power3.out",
        scrollTrigger: { trigger: styles, start: "top 70%" },
      });
    }

    // ---------- features ----------
    const features = root.querySelector<El>("#features");
    if (features) {
      gsap.from(features.firstElementChild, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: features, start: "top 80%" },
      });
      const grid = features.lastElementChild;
      if (grid) {
        ScrollTrigger.batch([...grid.children], {
          start: "top 85%",
          once: true,
          onEnter: (els) => gsap.from(els, { y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }),
        });
      }

      // Mini graphics in "Every scene animated".
      const tile = (name: string) => byText(name, features)?.parentElement;
      const orbit = tile("Orbital Node")?.firstElementChild;
      if (orbit) gsap.to(orbit, { rotation: 360, duration: 6, repeat: -1, ease: "none" });
      const ramp = tile("Metric Ramp")?.firstElementChild;
      if (ramp) {
        [...ramp.children].forEach((b, n) => {
          gsap.to(b, {
            scaleY: 0.4,
            transformOrigin: "50% 100%",
            duration: 0.8,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            delay: n * 0.2,
          });
        });
      }
      const split = tile("Split Grid")?.querySelector("svg");
      if (split)
        gsap.to(split, { rotation: 90, duration: 1.2, yoyo: true, repeat: -1, repeatDelay: 0.8, ease: "power2.inOut" });
      const flow = tile("Flow Shift")?.querySelector("svg");
      if (flow) gsap.to(flow, { x: 8, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" });

      // Voice chips: selection moves down the list.
      const chips = ["Liam · Energetic", "Jessica · Expressive", "George · Storyteller"].map(
        (n) => byText(n, features)?.parentElement,
      );
      const [c0, c1] = chips;
      if (c0 && c1 && chips.every(Boolean)) {
        const onC = c0.className;
        const offC = c1.className;
        const onBadge = (c0.lastElementChild as El).className;
        const offBadge = (c1.lastElementChild as El).className;
        let v = 0;
        const cycle = loop(() => {
          v = (v + 1) % 3;
          chips.forEach((c, k) => {
            if (!c) return;
            const badge = c.lastElementChild as El;
            c.className = k === v ? onC : offC;
            badge.className = k === v ? onBadge : offBadge;
            badge.textContent = k === v ? "SELECTED" : "Preview";
          });
        }, 2000);
        loops.push(cycle);
        whileVisible(features, cycle.start, cycle.stop);
      }

      // Karaoke caption: highlight walks through the words.
      const capLine = [...features.querySelectorAll("p")].find((p) => p.textContent?.includes("Stop wasting"));
      const capHl = capLine?.querySelector("span");
      if (capLine && capHl) {
        const hlClass = capHl.className;
        const originalHtml = capLine.innerHTML;
        restores.push(() => {
          capLine.innerHTML = originalHtml;
        });
        const words = (capLine.textContent ?? "").trim().split(/\s+/);
        capLine.innerHTML = words.map((w) => `<span class="cw-k">${w}</span>`).join(" ");
        const ks = [...capLine.querySelectorAll<El>(".cw-k")];
        let w = -1;
        const walk = loop(() => {
          w = (w + 1) % ks.length;
          ks.forEach((el, k) => {
            el.className = k === w ? `cw-k ${hlClass}` : "cw-k";
          });
        }, 420);
        loops.push(walk);
        whileVisible(capLine, walk.start, walk.stop);
      }

      // Brand swatches pulse; fact checks tick in one by one.
      const brandRow = byText("Brand kit", features)?.parentElement;
      if (brandRow) {
        gsap.to([...brandRow.children].slice(0, 4), {
          scale: 1.15,
          duration: 0.5,
          stagger: 0.15,
          yoyo: true,
          repeat: -1,
          repeatDelay: 1.2,
          ease: "power2.inOut",
        });
      }
      const checks = ["Claims checked", "Wrong numbers fixed", "Doubtful stats removed"]
        .map((t) => byText(t, features)?.parentElement)
        .filter((x): x is El => Boolean(x));
      if (checks[0]) {
        gsap.from(checks, {
          x: -16,
          opacity: 0,
          duration: 0.5,
          stagger: 0.35,
          ease: "power2.out",
          scrollTrigger: { trigger: checks[0], start: "top 85%" },
        });
      }
    }

    // ---------- final call to action ----------
    const cta = root.querySelector<El>("#early-access");
    const ctaPanel = cta?.firstElementChild as El | null;
    if (cta && ctaPanel) {
      gsap.from(ctaPanel, {
        scale: 0.94,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: cta, start: "top 80%" },
      });
      const h2 = ctaPanel.querySelector("h2");
      if (h2) {
        const originalH2 = h2.innerHTML;
        restores.push(() => {
          h2.innerHTML = originalH2;
        });
        h2.innerHTML = (h2.textContent ?? "")
          .trim()
          .split(" ")
          .map(
            (w) =>
              `<span style="display:inline-block;overflow:hidden;vertical-align:bottom"><span class="cw-r" style="display:inline-block">${w}</span></span>`,
          )
          .join(" ");
        gsap.from(h2.querySelectorAll(".cw-r"), {
          yPercent: 110,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: cta, start: "top 70%" },
        });
      }
      const orb = ctaPanel.firstElementChild;
      if (orb) gsap.to(orb, { scale: 1.25, opacity: 0.7, duration: 3.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
      const btn = ctaPanel.querySelector("[data-cta]");
      if (btn) {
        gsap.to(btn, {
          boxShadow: "0 0 32px rgba(198,244,50,0.65)",
          duration: 1.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });
      }
    }
  }, root);

  return () => {
    for (const t of timers) clearInterval(t);
    for (const l of loops) l.stop();
    root.removeEventListener("click", onAnchorClick);
    ctx.revert(); // kills tweens and ScrollTriggers created inside the context
    for (const r of restores) r();
    gsap.ticker.remove(raf);
    lenis.destroy();
  };
}
