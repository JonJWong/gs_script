const fs = require('fs');
const size = require('image-size');

// Change this to your desired pack directory
const dir = './';

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

// throw new ParserException('This is a parser exception');
// ...
// catch(error) {
//   switch(error.name) {
//     case 'ParserException':
//       console.log('There was an error parsing '+ `${error.fileName}`)
//       console.log(error.message);
//       return;
//     case 'WriterException':
//       console.log('There was an error editing ' + `${error.fileName}`)
//       console.log(error.message);
//       return;
//   }
// }

try {
  // get all files/folders within specified directory in an array
  let itemsInDir = fs.readdirSync(dir);

  let bannerUrl = null;
  let bgUrl = null;
  let checked = false;

  const songFolders = [];
  const files = [];
  const images = [];

  // populate songFolders array and files array
  for (let i = 0; i < itemsInDir.length; i++) {
    // if current file is a directory (a song folder), add to array
    // if it is not a directory, it is either an image or file within folder
    if (itemsInDir[i].isDirectory()) {
      songFolders.push(itemsInDir[i]);
    } else {
      files.push(itemsInDir[i]);
    };
  };

  // look through the files for images, for fallback banner and bg
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];

    if (checkIfImage(fileName)) {
      images.push(fileName);
      // get the dimensions (requires npm install 'image-size' --save)
      const {
        height,
        width,
        type
      } = size(dir + fileName); // output = { height: x, width: y, type: .ext }

      const aspectRatio = findAspectRatio(width, height);
      // if it's a banner aspect ratio, set banner variable i.e. './shitbanner.png'
      if (aspectRatio === '64:25') {
        bannerUrl = dir + fileName;
        continue;
      } else {
        bgUrl = dir + fileName;
        continue;
      };
    };
    checked = true;
  };

} catch(error) {
  switch(error.name) {
    case 'ParserException':
      console.log('There was an error parsing '+ `${error.fileName}`)
      console.log(error.message);
      return;
    case 'WriterException':
      console.log('There was an error editing ' + `${error.fileName}`)
      console.log(error.message);
      return;
  };
};