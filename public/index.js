const uploadSection = document.getElementById('upload-section');
const spinner = document.querySelector(".spinner");
const loadingText = document.querySelector(".loading-text");

const loadingMsgs = [
  "Making the beatmap look amazing...",
  "Baking some pretty lights...",
  "Relentlessly calculating the perfect laser speed...",
  "Generating the perfect lightshow...",
]

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

class Note {
  constructor(note, nextNote) {
    this.raw = note;
    this.padding = (nextNote ? nextNote._time : note._time + 1) - note._time;
  }
}

function hideuploadSection() {

  uploadSection.style.opacity = 0;

  uploadSection.addEventListener('transitionend', () => {
    uploadSection.style.display = 'none';
  }, { once: true });

}

function showuploadSection() {

  uploadSection.style.display = 'initial';
  setTimeout(() => {
    uploadSection.style.opacity = 1;
  }, 100);

}

function showSpinner() {
  spinner.style.display = "flex";
}

function hideSpinner() {
  spinner.style.display = "none";
}


function showLoadingText() {
  loadingText.textContent = loadingMsgs[Math.floor(Math.random() * loadingMsgs.length)];
  loadingText.style.display = "initial";
}

function hideLoadingText() {
  loadingText.style.display = "none";
}

function showDownloadSection(beatmap) {
  const downloadSection = document.getElementById("download-section");
  downloadSection.style.display = "initial";

  setTimeout(() => {
    downloadSection.style.opacity = 1;
  }, 100);

  const downloadButton = document.getElementById("download-btn");

  // generate a random filename
  const randomString = Math.random().toString(36).substring(2, 10)
  downloadButton.addEventListener("click", () => {
    const blob = new Blob([beatmap], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `litemapper_${randomString}.dat`;
    link.click();
    URL.revokeObjectURL(url);
    link.remove();
  });
}


function hideDownloadSection() {
  const downloadSection = document.getElementById("download-section");
  downloadSection.style.opacity = 0;

  downloadSection.addEventListener('transitionend', () => {
    downloadSection.style.display = 'none';
  }, { once: true });
}


const EventTemplate = {
  ringRotation(time) {
    return {
      _time: time,
      _type: 8,
      _value: 0
    }
  },
  ringZoom(time) {
    return {
      _time: time,
      _type: 9,
      _value: 0
    }
  }
};

document.getElementById('upload-btn').addEventListener('click', openDialog);

document.getElementById('reset-btn').addEventListener('click', async () => {
  window.location.reload();
});

function openDialog() {
  document.getElementById('beatmap-input').click();
  document.getElementById('beatmap-input').addEventListener('change', init, { once: true });
}



async function init() {
  const fileInput = document.getElementById("beatmap-input");

  if (fileInput.files.length < 1) {
    return console.error("No file selected!");
  }

  hideuploadSection()
  await sleep(300);
  showSpinner();
  await sleep(500);
  showLoadingText();
  const fileReader = new FileReader();
  fileReader.onload = async (event) => {
    try {
      const finalBeatmap = await calculate(event.target.result);
      hideSpinner();
      hideLoadingText();
      showDownloadSection(finalBeatmap);

    } catch (e) {
      hideSpinner();
      showuploadSection();
      hideLoadingText();
      alert(e);
      fileInput.value = "";
    }
  };
  fileReader.readAsText(fileInput.files[0]);
}



async function calculate(_input) {
  let beatmap = { _version: "", _notes: [], _events: [] };

  try {
    beatmap = JSON.parse(_input);
  } catch (e) {
    throw new Error("Failed to parse beatmap!");
  }
  if (!beatmap._version) throw new Error("Invalid beatmap version! V3 mapping is not supported yet!");
  if (!beatmap._notes) throw new Error("Not a valid beatmap!");

  let lastPadding = 0;
  let lastTime;
  let leftLaserNext = true;
  const paceChanges = [""];
  beatmap._events = [];

  for (let i = 0; i < beatmap._notes.length; i++) {
    let nextNote = null;
    let n = i;
    let addedRingRotation = false;
    let doubleLasers = false;

    while (nextNote == null) {
      n++;
      const nextUp = beatmap._notes[n];
      if (!nextUp) {
        nextNote = { _time: beatmap._notes[n - 1]._time * 2 };
        break;
      }
      if (nextUp._time == beatmap._notes[i]._time) {
        if (!addedRingRotation) {
          beatmap._events.push(EventTemplate.ringRotation(beatmap._notes[i]._time));
          addedRingRotation = true;
        }
        doubleLasers = true;
        continue;
      }
      nextNote = nextUp;
    }

    if (lastTime == beatmap._notes[i]._time) continue;

    const note = new Note(beatmap._notes[i], nextNote);
    let lightValue, lightType, pacePrefix = null;

    if (note.raw._cutDirection == 8 || note.raw._type == 3) {
      beatmap._events.push({ _time: note.raw._time, _type: 0, _value: note.padding < 1 ? 6 : 2 });
      beatmap._events.push({ _time: note.raw._time, _type: 4, _value: 0 });
      if (note.raw._type == 3) continue;
    } else if (note.padding >= 2) {
      if (lastPadding < 2 || i < 1) {
        beatmap._events.push(EventTemplate.ringZoom(note.raw._time));
        pacePrefix = "0";
      }
      lightType = 4;
      lightValue = 3;
    } else if (note.padding >= 1) {
      if (lastPadding < 1 || lastPadding >= 2 || i < 1) {
        beatmap._events.push(EventTemplate.ringZoom(note.raw._time));
        pacePrefix = "a";
      }
      lightType = 4;
      lightValue = 2;
    } else {
      if (lastPadding >= 1 || i < 1) {
        beatmap._events.push(EventTemplate.ringZoom(note.raw._time));
        pacePrefix = "b";
      }
      lightType = 4;
      lightValue = 6;
    }

    if (pacePrefix != null) {
      paceChanges.push(pacePrefix + note.raw._time);
    }

    if (note.raw._cutDirection != 8) {
      beatmap._events.push({ _time: note.raw._time, _type: lightType, _value: lightValue });
      beatmap._events.push({ _time: note.raw._time, _type: 0, _value: 0 });
    }

    let laserColor = note.padding < 1 ? 7 : 3;
    let laserSide;

    if (doubleLasers && note.padding >= 2) {
      beatmap._events.push({ _time: note.raw._time, _type: 3, _value: laserColor });
      beatmap._events.push({ _time: note.raw._time, _type: 2, _value: laserColor });
      beatmap._events.push({ _time: note.raw._time, _type: 12, _value: calculateLaserSpeed(note.padding) });
      beatmap._events.push({ _time: note.raw._time, _type: 13, _value: calculateLaserSpeed(note.padding) });
    } else if (leftLaserNext) {
      leftLaserNext = false;
      laserSide = 2;
      beatmap._events.push({ _time: note.raw._time, _type: 3, _value: 0 });
    } else {
      leftLaserNext = true;
      laserSide = 3;
      beatmap._events.push({ _time: note.raw._time, _type: 2, _value: 0 });
    }

    if (!doubleLasers || note.padding < 2) {
      beatmap._events.push({ _time: note.raw._time, _type: laserSide == 2 ? 12 : 13, _value: calculateLaserSpeed(note.padding) });
      beatmap._events.push({ _time: note.raw._time, _type: laserSide, _value: laserColor });
    }

    lastPadding = note.padding;
    lastTime = note.raw._time;
  }

  for (let i = 0; i < paceChanges.length; i++) {
    let ringValue = 0;
    switch (paceChanges[i].charAt(0)) {
      case "a":
        ringValue = 3;
        break;
      case "b":
        ringValue = 7;
        break;
    }

    if (ringValue == 0 || paceChanges.length == i + 1) continue;

    let currentTimestamp = Math.ceil(parseFloat(paceChanges[i].substring(1)));
    let nextTimestamp = Math.ceil(parseFloat(paceChanges[i + 1].substring(1)));

    if (currentTimestamp != parseFloat(paceChanges[i].substring(1))) {
      beatmap._events.push({ _time: parseFloat(paceChanges[i].substring(1)), _type: 1, _value: ringValue });
    }

    while (currentTimestamp < nextTimestamp) {
      beatmap._events.push({ _time: currentTimestamp, _type: 1, _value: ringValue });
      currentTimestamp++;
    }
  }

  const finalBeatmap = JSON.stringify(beatmap);

  await sleep(2500);

  return finalBeatmap;
}



function calculateLaserSpeed(padding) {
  return Math.ceil((Math.ceil((2 / padding) + 1) ** 2) / 4)
}



