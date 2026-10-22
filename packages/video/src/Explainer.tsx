import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./layers/Background";
import { Captions } from "./layers/Captions";
import { ProgressBar } from "./layers/ProgressBar";
import { Bullets } from "./templates/Bullets";
import { ImageFocus } from "./templates/ImageFocus";
import { Stat } from "./templates/Stat";
import { Title } from "./templates/Title";
import { theme } from "./theme";
import type { Timeline, TimelineScene } from "./types";
import { VisualView } from "./visuals/VisualView";

const SceneBody = ({ scene }: { scene: TimelineScene }) => {
  const duration = scene.endFrame - scene.startFrame;
  if (scene.template === "stat" && scene.stat) return <Stat value={scene.stat.value} label={scene.stat.label} />;
  if (scene.template === "imageFocus" && scene.imageFile) {
    return <ImageFocus src={staticFile(scene.imageFile)} label={scene.onScreenText[0] ?? ""} duration={duration} />;
  }

  const compact = Boolean(scene.visual);
  const text =
    scene.template === "title" ? (
      <Title text={scene.onScreenText[0] ?? ""} compact={compact} />
    ) : (
      <Bullets lines={scene.onScreenText} duration={duration} compact={compact} />
    );
  return (
    <>
      {scene.visual ? <VisualView visual={scene.visual} duration={duration} /> : null}
      {text}
    </>
  );
};

// Fades a scene in at its start and out over the extra frames it overlaps the next scene, giving a crossfade.
const Fade = ({
  children,
  fadeIn,
  fadeOutAt,
}: {
  children: React.ReactNode;
  fadeIn: boolean;
  fadeOutAt: number | null;
}) => {
  const frame = useCurrentFrame();
  const t = theme.transitionFrames;
  const opacityIn = fadeIn ? interpolate(frame, [0, t], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const opacityOut =
    fadeOutAt === null
      ? 1
      : interpolate(frame, [fadeOutAt, fadeOutAt + t], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(opacityIn, opacityOut) }}>{children}</AbsoluteFill>;
};

export const Explainer = (timeline: Timeline) => (
  <AbsoluteFill style={{ backgroundColor: theme.background, fontFamily: theme.fontFamily, color: theme.text }}>
    <Background />
    {timeline.audioFile ? <Audio src={staticFile(timeline.audioFile)} /> : null}
    {timeline.scenes.map((scene, i) => {
      const isLast = i === timeline.scenes.length - 1;
      const length = scene.endFrame - scene.startFrame;
      return (
        <Sequence
          key={scene.index}
          from={scene.startFrame}
          durationInFrames={length + (isLast ? 0 : theme.transitionFrames)}
          name={`Scene ${scene.index} · ${scene.visual?.type ?? scene.template}`}
        >
          <Fade fadeIn={i > 0} fadeOutAt={isLast ? null : length}>
            <SceneBody scene={scene} />
          </Fade>
        </Sequence>
      );
    })}
    <Captions words={timeline.words} pages={timeline.captionPages} />
    <ProgressBar />
  </AbsoluteFill>
);
