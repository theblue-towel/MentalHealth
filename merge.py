#!/usr/bin/env python3
import pandas as pd
import sys, traceback, os

def main():
    cwd = os.getcwd()
    print(f"ℹ️  merge.py running in: {cwd}", flush=True)
    print(f"ℹ️  directory listing: {os.listdir(cwd)}", flush=True)

    # 1) Load activity.csv
    act_path = 'activity.csv'
    if not os.path.exists(act_path):
        print(f"ERROR: {act_path} not found", file=sys.stderr)
        sys.exit(1)
    print(f"ℹ️  Loading {act_path}…", flush=True)
    try:
        website_df = pd.read_csv(
            act_path,
            header=None,
            names=['start_time','end_time','window_title','app_name','duration_seconds']
        )
    except Exception as e:
        print(f"ERROR parsing {act_path}: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ℹ️  Loaded {len(website_df)} activity rows", flush=True)

    # 2) Build the 'website' field
    website_df['website'] = (
        website_df['app_name'].fillna('') +
        website_df['window_title'].fillna('').apply(lambda s: f" – {s}" if s else '')
    )

    # 3) Load emotion.csv
    emo_path = 'emotion.csv'
    if not os.path.exists(emo_path):
        print(f"ERROR: {emo_path} not found", file=sys.stderr)
        sys.exit(1)
    print(f"ℹ️  Loading {emo_path}…", flush=True)
    try:
        emotion_df = pd.read_csv(emo_path)
        if 'timestamp' not in emotion_df.columns:
            emotion_df = pd.read_csv(
                emo_path,
                header=None,
                names=['timestamp','emotion']
            )
    except Exception as e:
        print(f"ERROR parsing {emo_path}: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ℹ️  Loaded {len(emotion_df)} emotion rows", flush=True)

    # 4) Normalize & round timestamps
    print("ℹ️  Converting and rounding timestamps…", flush=True)
    website_df['end_time'] = (
        pd.to_datetime(website_df['end_time'], utc=True, errors='coerce')
          .dt.tz_convert('America/Los_Angeles')
          .dt.tz_localize(None)
          .dt.round('s')
    )
    emotion_df['timestamp'] = (
        pd.to_datetime(emotion_df['timestamp'], errors='coerce')
          .dt.round('s')
    )

    # 4.1) Diagnostic dtypes
    print(f"ℹ️  end_time dtype: {website_df['end_time'].dtype}", flush=True)
    print(f"ℹ️  timestamp dtype: {emotion_df['timestamp'].dtype}", flush=True)

    # 5) Drop any rows we couldn’t parse
    before_w, before_e = len(website_df), len(emotion_df)
    website_df = website_df.dropna(subset=['end_time'])
    emotion_df = emotion_df.dropna(subset=['timestamp'])
    print(f"ℹ️  Dropped {before_w - len(website_df)} bad activity rows", flush=True)
    print(f"ℹ️  Dropped {before_e - len(emotion_df)} bad emotion rows", flush=True)

    # 6) Inner-join on end_time == timestamp
    print("ℹ️  Merging on end_time == timestamp…", flush=True)
    try:
        final = pd.merge(
            website_df,
            emotion_df,
            left_on='end_time',
            right_on='timestamp',
            how='inner'
        )
    except Exception as e:
        print(f"ERROR during merge: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ℹ️  Matched {len(final)} rows", flush=True)

    # 7) Select the columns you want
    final = final[[
        'start_time','end_time','window_title',
        'app_name','duration_seconds','website','emotion'
    ]]

    # 8) Write final.csv
    print("ℹ️  Writing final.csv…", flush=True)
    try:
        final.to_csv('final.csv', index=False)
    except Exception as e:
        print(f"ERROR writing final.csv: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"🖨️  Written {len(final)} rows to final.csv", flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
