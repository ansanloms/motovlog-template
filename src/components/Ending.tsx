import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./Ending.module.css";

type Props = {
  episode: string; // episodeHeader() 済み (例 "EP.12 / 愛媛")
  date: string; // "2026.08.15-17"
  distance: string; // "318 km"
  ridingTime: string; // "8:12"
  route: readonly string[]; // 5〜7 か所 (コードでは縛らない)
  credits: readonly string[]; // 例 ["VOICEVOX: 青山龍星", "立ち絵: Jacca さま"]
};

// ED (T&M「OP・ED・サムネ用フレーム」節)。罫線だけの計器表示。RIDE LOG と
// 話数、DATE / DISTANCE / RIDING TIME と ROUTE、クレジットを出す。カットイン
// (フェードなし) は組み立て側 (EndingTrack) が扱う。固定 props で、フレーム
// 依存の値は無い。
export const Ending: React.FC<Props> = ({
  episode,
  date,
  distance,
  ridingTime,
  route,
  credits,
}) => {
  return (
    <AbsoluteFill className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.prompt}>&gt;&nbsp;</span>RIDE LOG
        </div>
        <div>{episode}</div>
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <div className={styles.label}>DATE</div>
          <div className={styles.value}>{date}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>DISTANCE</div>
          <div className={styles.value}>{distance}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>RIDING TIME</div>
          <div className={styles.value}>{ridingTime}</div>
        </div>
        <div className={styles.routeRow}>
          <div className={styles.label}>ROUTE</div>
          <div className={styles.route}>
            {route.map((place, index) => (
              <React.Fragment key={`${place}-${index}`}>
                {index > 0 ? <span className={styles.arrow}> → </span> : null}
                {place}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        {credits.map((credit, index) => (
          <span key={index}>{credit}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
