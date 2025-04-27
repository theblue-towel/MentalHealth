#!/usr/bin/env python3
import cv2
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime
from deepface import DeepFace
import numpy as np
import signal
import sys

# Mapping emotion to numbers
emotion_map = {
    'angry':    0,
    'disgust':  1,
    'fear':     2,
    'sad':      3,
    'neutral':  4,
    'surprise': 5,
    'happy':    6
}

log = []
emotion_vals = []
smoothed_vals = []

def smooth(vals, window_size=5):
    if len(vals) < window_size:
        return vals
    sm = np.convolve(vals, np.ones(window_size)/window_size, mode='valid')
    return [sm[0]]*(window_size-1) + sm.tolist()

# Live plot setup
fig, ax = plt.subplots()
line, = ax.plot([], [], 'o-')
ax.set_ylim(-0.5, 6.5)
ax.set_yticks(list(emotion_map.values()))
ax.set_yticklabels(list(emotion_map.keys()))
ax.set_xlabel('Frame #')
ax.set_ylabel('Emotion')
ax.set_title('Live Smoothed Emotion Tracking')
cmap = plt.cm.RdYlGn

def animate(_):
    if emotion_vals:
        smoothed_vals.clear()
        smoothed_vals.extend(smooth(emotion_vals))
        norm = smoothed_vals[-1] / max(emotion_map.values())
        line.set_color(cmap(norm))
        line.set_data(range(len(smoothed_vals)), smoothed_vals)
        ax.set_xlim(max(0, len(smoothed_vals)-10), len(smoothed_vals))
    return line,

ani = animation.FuncAnimation(fig, animate, interval=1000)

# Open webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Cannot open webcam")
    sys.exit(1)

def shutdown(signum, frame):
    """Release resources & dump CSV on SIGINT/SIGTERM."""
    cap.release()
    cv2.destroyAllWindows()
    plt.close(fig)
    if log:
        pd.DataFrame(log).to_csv('emotion.csv', index=False)
        print("\n✅ Emotion log saved to emotion.csv")
    else:
        print("\n⚠️ No data to save.")
    sys.exit(0)

# Catch Ctrl-C / termination
signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame")
            break

        # Analyze emotion
        try:
            analysis = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
            # analysis is a list of dicts (one per face), so take the first
            if isinstance(analysis, list) and len(analysis) > 0:
                emotion = analysis[0].get('dominant_emotion')
            elif isinstance(analysis, dict):
                emotion = analysis.get('dominant_emotion')
            else:
                raise ValueError("Unexpected DeepFace output")
            if not emotion:
                raise ValueError("No dominant_emotion found")
        except Exception as e:
            print(f"⚠️ Analysis error: {e}")
            continue

        # Annotate & log
        cv2.putText(frame, f"Emotion: {emotion}", (50,50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255,0,0), 2)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log.append({'timestamp': now, 'emotion': emotion})
        emotion_vals.append(emotion_map.get(emotion.lower(), emotion_map['neutral']))

        cv2.imshow('Emotion Recognition', frame)
        plt.pause(0.001)

        # Quit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            shutdown(None, None)

except Exception as e:
    print(f"Unexpected error: {e}")
    shutdown(None, None)
