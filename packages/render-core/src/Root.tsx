import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { StockGraphUp } from "./StockGraphUp";

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
    </>
  );
};
