# analyze.py
import sys, traceback, os
import pandas as pd

def main():
    # 1) Read final.csv
    path = 'final.csv'
    if not os.path.exists(path):
        print(f"ERROR: {path} not found", file=sys.stderr); sys.exit(1)

    df = pd.read_csv(path)
    print(f"ℹ️  final.csv columns = {list(df.columns)}")

    # 2) Verify we have website+emotion
    for col in ('website','emotion'):
        if col not in df.columns:
            print(f"ERROR: missing {col!r}", file=sys.stderr); sys.exit(1)

    # 3) Compute mode per website
    summary = (
        df.groupby('website')['emotion']
          .agg(lambda x: x.mode()[0])
          .reset_index(name='emotion')
    )
    summary.to_csv('emotion_analysis.csv', index=False)
    print(f"✅ Wrote emotion_analysis.csv with {len(summary)} rows")

    # 4) Build your buckets
    pos = ['happy','surprise']
    neg = ['angry','disgust','fear','sad','neutral']

    pos_sites   = summary[summary['emotion'].isin(pos)]['website'].tolist()
    neg_sites   = summary[summary['emotion'].isin(neg)]['website'].tolist()
    happy_sites = summary[summary['emotion']=='happy']['website'].tolist()

    # 5) Assemble report
    lines = ["Websites linked to positive emotions:"]
    lines += [f"{i+1}. {w}" for i,w in enumerate(pos_sites)]
    lines += ["", "Websites linked to negative emotions:"]
    lines += [f"{i+1}. {w}" for i,w in enumerate(neg_sites)]
    lines += ["", "Websites that specifically make you happy:"]
    lines += [f"{i+1}. {w}" for i,w in enumerate(happy_sites)]
    report = "\n".join(lines)

    # 6) Output
    print(report)
    with open('emotion_websites_report.txt','w') as f:
        f.write(report)
    print("✅ Wrote emotion_websites_report.txt")

if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
