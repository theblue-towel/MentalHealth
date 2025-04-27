MoodSwing detects what emotions the user is feeling and determines which websites harm and benefit the user's mental health.

Made for OcsefHacks 2025.

--------------------------DOCUMENTATION-----------------------------

1. Clone the git repo.
2. Do "npm i" to install npm and node modules.
3. Create a new virtual environment and do this command to install needed python libraries:
   
5. pip install opencv-python pandas matplotlib deepface tf-keras numpy signal sys
6. (you might need to use pip3 to install modules)

7. Then you need to give the program (vs code or whatever you're using to run) permission to record the screen.
8. Then run the program using the command "node tracker.js".

-----------------------POSSIBLE ERRORS------------------------------

10. If you now encounter an error about emotion, you might have to go into emotion.py and change line 50
cap = cv2.VideoCapture(0) to cap = cv2.VideoCapture(1)

11. If you get an error about merging, you just didn't save your data yet.
12. If you use Chrome as your browser, the program might not be able to pull website data.
