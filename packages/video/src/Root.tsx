import { Composition } from "remotion";
import { Explainer } from "./Explainer";
import { sampleTimeline } from "./sample";
import type { Timeline } from "./types";

export const RemotionRoot = () => (
  <Composition
    id="Explainer"
    component={Explainer}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={sampleTimeline.durationInFrames}
    defaultProps={sampleTimeline}
    calculateMetadata={({ props }: { props: Timeline }) => ({ durationInFrames: props.durationInFrames })}
  />
);
