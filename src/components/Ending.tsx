import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./Ending.module.css";
import { formatDateRange, formatRidingTime } from "./endingFormat.ts";
import type { DateRange } from "./endingFormat.ts";

/** Ending が受け取るもの。 */
type Props = {
  /** 上段左の文字列 (例 "RIDE LOG")。`>` のプロンプト記号は component が付ける。 */
  title: string;
  /** 上段右の文字列 (例 "EP.12 / 愛媛")。 */
  subtitle: string;
  /** 走行日の範囲 (ADR-0007)。単日は from と to を同じ日にする。 */
  date: DateRange;
  /** 走行距離 (km)。 */
  distance: number;
  /** 走行時間 (ADR-0007)。 */
  ridingTime: Temporal.Duration;
  /** 5〜7 か所 (コードでは縛らない)。 */
  routes: readonly string[];
  /** 1 要素 = 1 行。key: value で表示。例 [{ VOICEVOX: "青山龍星" }]。 */
  credits: ReadonlyArray<Record<string, string>>;
};

/**
 * ED (T&M「OP・ED・サムネ用フレーム」節)。罫線だけの計器表示。上段左右に
 * title と subtitle (既定は RIDE LOG と話数)、DATE / DISTANCE / RIDING TIME
 * と ROUTE、クレジットを出す。カットイン (フェードなし) は組み立て側
 * (EndingTrack) が扱う。固定 props で、フレーム依存の値は無い。
 */
export const Ending: React.FC<Props> = ({
  title,
  subtitle,
  date,
  distance,
  ridingTime,
  routes,
  credits,
}) => {
  return (
    <AbsoluteFill className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.prompt}>&gt;&nbsp;</span>
          {title}
        </div>
        <div>{subtitle}</div>
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <div className={styles.label}>DATE</div>
          <div className={styles.value}>{formatDateRange(date)}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>DISTANCE</div>
          <div className={styles.value}>{distance} km</div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>RIDING TIME</div>
          <div className={styles.value}>{formatRidingTime(ridingTime)}</div>
        </div>
        <div className={styles.routeRow}>
          <div className={styles.label}>ROUTE</div>
          <div className={styles.route}>
            {routes.map((place, index) => (
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
          <span key={index}>
            {Object.entries(credit)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" ")}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
