import { Video } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile } from "remotion";

type ProbeProps = {
  src: string;
};

const Probe: React.FC<ProbeProps> = ({ src }) => {
  return (
    <AbsoluteFill>
      <Video src={staticFile(src)} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Probe"
        component={Probe}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={36000}
        defaultProps={{ src: "probe-c.mp4" }}
      />
      <Composition
        id="Probe-B-hevc"
        component={Probe}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={76932}
        defaultProps={{ src: "probe-b.mp4" }}
      />
      <Composition
        id="Probe-E-nvenc"
        component={Probe}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={900}
        defaultProps={{ src: "probe-e.mp4" }}
      />
    </>
  );
};
