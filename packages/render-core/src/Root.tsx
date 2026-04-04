import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { StockGraphUp } from "./StockGraphUp";
import { FerroComposite, type FerroCompositeProps } from "./FerroComposite";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={60}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="StockGraphUp"
        component={StockGraphUp}
        durationInFrames={240}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="FerroComposite"
        component={FerroComposite}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          layers: [],
          videoSrc: "",
          durationInFrames: 300,
          fps: 30,
          width: 1920,
          height: 1080,
        } satisfies FerroCompositeProps}
        calculateMetadata={({ props }) => {
          const p = props as unknown as FerroCompositeProps
          return {
            durationInFrames: p.durationInFrames,
            fps: p.fps,
            width: p.width,
            height: p.height,
          }
        }}
      />
    </>
  );
};
