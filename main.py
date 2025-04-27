import cv2
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime
from deepface import DeepFace
import numpy as np

# Mapping emotion to numbers for plotting
emotion_map = {
    'angry': 0,
    'disgust': 1,
    'fear': 2,
    'sad': 3,
    'neutral': 4,
    'surprise': 5,
    'happy': 6
}
emotion_list = list(emotion_map.keys())

# Open webcam
cap = cv2.VideoCapture(0)

# Create a log list
log = []

# Lists for plotting
timestamps = []
emotion_vals = []
smoothed_emotion_vals = []

# Smoothing function
def smooth(values, window_size=5):
    if len(values) < window_size:
        return values
    smoothed = np.convolve(values, np.ones(window_size)/window_size, mode='valid')
    # Pad the start to keep array lengths the same
    padding = [smoothed[0]] * (window_size-1)
    return list(padding + list(smoothed))

# Set up live plot
fig, ax = plt.subplots()
line, = ax.plot([], [], 'o-', color='blue')  # Initial line color
ax.set_ylim(-0.5, 6.5)
ax.set_yticks(list(emotion_map.values()))
ax.set_yticklabels(emotion_list)
ax.set_xlabel('Time')
ax.set_ylabel('Emotion')
ax.set_title('Live Smoothed Emotion Tracking')

# Colormap to represent emotion values
cmap = plt.cm.RdYlGn  # Red to Green colormap

def animate(i):
    if len(timestamps) > 0:
        smoothed_emotion_vals.clear()
        smoothed_emotion_vals.extend(smooth(emotion_vals, window_size=5))

        # Get the current emotion value and map it to a color
        norm_val = smoothed_emotion_vals[-1] / 6  # Normalize to range [0, 1]
        color = cmap(norm_val)  # Get color from colormap

        # Update the line with the new color and data
        line.set_data(range(len(smoothed_emotion_vals)), smoothed_emotion_vals)
        line.set_color(color)  # Change line color based on emotion value

        # Scroll the graph: show the last 10 points
        ax.set_xlim(max(0, len(smoothed_emotion_vals) - 10), len(smoothed_emotion_vals))

    return line,

ani = animation.FuncAnimation(fig, animate, interval=1000)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    try:
        # Try to analyze the frame, but add a try-except block to catch potential issues
        analysis = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
        emotion = analysis[0]['dominant_emotion']

        # Show emotion on screen
        cv2.putText(frame, f"Emotion: {emotion}", (50,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,0,0), 2)

        # Append to log
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log.append({"timestamp": timestamp, "emotion": emotion})

        # Update plot data
        timestamps.append(timestamp)
        emotion_vals.append(emotion_map.get(emotion.lower(), 6))  # default to neutral if unknown

    except Exception as e:
        print(f"Error with face analysis: {e}")
        # Optionally, continue processing if there's an issue with face analysis
        continue

    # Display frame
    cv2.imshow('Emotion Recognition', frame)
    plt.pause(0.001)  # Needed to update plot live

    # Press 'q' to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# After loop ends, save log to CSV
cap.release()
cv2.destroyAllWindows()
plt.close()

# Save to CSV
if log:
    df = pd.DataFrame(log)
    df.to_csv('emotion_log.csv', index=False)
    print("Emotion log saved to emotion_log.csv!")
else:
    print("No emotions were logged.")
