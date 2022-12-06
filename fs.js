const fs = require('fs');
const size = require('image-size');

// Change this to your desired pack directory with no / at the end
// i.e. "C:/Games/Stepmania 5/Stamina RPG 6"
const dir = '../shit';

// Banner aspect ratio should be 2.56:1
// Background aspect ratios can be 4:3, 16:9, 16:10, 5:4
const IMAGE_FILENAME_EXTENSIONS = [
  '.png',
  '.jpeg',
  '.jpg',
  '.mp4'
];

function ParserException(message, fileName) {
  this.fileName = fileName;
  this.message = message;
  this.name = 'ParserException';
};

function WriterException(message, fileName) {
  this.fileName = fileName;
  this.message = message;
  this.name = 'WriterException';
};

// recursive GCD function helper
function greatestCommonDenominator(a, b = 0) {
  if (b === 0) return a;
  return greatestCommonDenominator(b, a % b);
};

function findAspectRatio(w, h) {
  if (!w || !h) return 'error';
  const gcd = greatestCommonDenominator(w, h);
  const width = w / gcd;
  const height = h / gcd;
  return `${width}:${height}`;
};

function checkIfImage(string) {
  for (let extension of IMAGE_FILENAME_EXTENSIONS) {
    if (string.endsWith(extension)) {
      return true;
    };
  };
  return false;
};

try {
  console.log('Script starting...');
  // get all files/folders within specified directory in an array
  let songFolderItems = fs.readdirSync(dir);

  let fallbackBanner = null;
  let fallbackBg = null;
  let fallbackCheck = false;

  const songFolders = [];
  const files = [];
  let images = [];

  console.log('Iterating through main directory now');
  // populate songFolders array and files array
  for (let i = 0; i < songFolderItems.length; i++) {
    const path = dir + '/' + songFolderItems[i];
    console.log(`Currently on: ${songFolderItems[i]}`);

    // if current file is a directory (a song folder), add to array
    // if it is not a directory, it is either an image or file within folder
    if (fs.statSync(path).isDirectory()) {
      console.log(`Adding ${songFolderItems[i]} to songFolders`)
      songFolders.push(songFolderItems[i]);
    } else {
      console.log(`Adding ${songFolderItems[i]} to files`)
      files.push(songFolderItems[i]);
    };
  };

  console.log("Finished iterating through main directory");
  // look through the files for images, for fallback banner and bg
  // also sort out all the extraneous files
  for (let fileName of files) {
    // if file is an image, check it's aspect ratio and set it to either banner or bg
    if (checkIfImage(fileName)) {
      if (images.push(fileName)) console.log(`Adding ${fileName} to images`);
      // get the dimensions (requires npm install 'image-size' --save)
      const { width, height, type } = size(dir + '/' + fileName); // output = { height: x, width: y, type: .ext }

      const aspectRatio = findAspectRatio(width, height);
      // if it's a banner aspect ratio, set banner variable i.e. './shitbanner.png'
      if (aspectRatio === '64:25' && !fallbackBanner) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log('Reason: Aspect ratio matched 2.56:1 / 64:25');
        continue;
      }

      // catch edge cases where aspect ratio might not fit but has name designation
      if (fileName.endsWith('bn')) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log('Reason: file name ends with bn');
      }
      if (fileName.endsWith('bg')) {
        fallbackBg = fileName;
        console.log(`Set ${fallbackBg} as fallback background`);
        console.log('Reason: file name ends with bg');
      };
    };
  };

  console.log("Successfully checked for fallback banner and background");
  fallbackCheck = true;

  // if the banner is found, remove it from images array
  if (fallbackBanner) images = images.filter((image) => image !== fallbackBanner);
  
  // if there is no fallback background yet and images array has something, set as fallback bg
  if (!fallbackBg && images.length) {
    fallbackBg = images[0];
    console.log(`Set ${fallbackBg} as fallback background`);
    console.log('Reason: No distinct fallback bg found, defaulting to first non-banner image');
  };
  
  
  console.log('Execution finished for now');
} catch(error) {
  if (error.name) {
    switch(error.name) {
      case 'ParserException':
        console.log('There was an error parsing '+ `${error.fileName}`)
        console.log(error.message);
        break;
      case 'WriterException':
        console.log('There was an error editing ' + `${error.fileName}`)
        console.log(error.message);
        break;
      default:
        console.log('An unspecified error has occured, halting execution');
        break;
    };
  } else {
    console.log('An unexpected error has occured, halting execution');
  }
};