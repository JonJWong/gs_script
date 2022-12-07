const fs = require('fs');
const size = require('image-size');
const iconvlite = require('iconv-lite');
const readline = require('readline-sync');

// Change this to your desired pack directory with no / at the end
// windows: 'C:/Games/Stepmania 5/Stamina RPG 6'
// macOSX: '/Users/jonmbp/Desktop/shit'
const rootDir = 'C:/Users/China/Desktop/testshit';

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

function compareChars(s1, s2) {
  if (!s1 || !s2) return Infinity;
  const count = {};
  for (let char of s1) {
    count[char] ||= 0;
    count[char]++;
  }

  for (let char of s2) {
    count[char]--;
  }

  const newCount = Object.values(count).filter(value => value !== 0);
  let sum = 0;
  for (let num of newCount) {
    if (num < 0) num *= -1;
    if (num) sum += num;
  }
  return sum;
}

try {
  console.log('Script starting...');
  // get all files/folders within specified directory in an array
  let songFolderItems = fs.readdirSync(rootDir);

  let fallbackBanner = null;
  let fallbackBg = null;
  let fallbackCheck = false;

  const songFolders = [];
  const files = [];
  let images = [];

  console.log('Iterating through main directory now');
  // populate songFolders array and files array
  for (let i = 0; i < songFolderItems.length; i++) {
    const path = rootDir + '/' + songFolderItems[i];
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
  // while sorting out all the extraneous files
  for (let fileName of files) {
    // if file is an image, check it's aspect ratio and set it to either banner or bg
    if (checkIfImage(fileName)) {
      if (images.push(fileName)) console.log(`Adding ${fileName} to images`);
      // get the dimensions (requires npm install 'image-size' --save)
      const { width, height, type } = size(rootDir + '/' + fileName); // output = { height: x, width: y, type: .ext }

      const aspectRatio = findAspectRatio(width, height);
      // if it's a banner aspect ratio, set banner variable i.e. './shitbanner.png'
      if (aspectRatio === '64:25' && !fallbackBanner) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log('Reason: Aspect ratio matched 2.56:1 / 64:25');
        continue;
      }

      // catch edge cases where aspect ratio might not fit but has name designation
      if (fileName.endsWith('bn') || fileName.endsWith('banner')) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log('Reason: file name ends with bn/banner');
      }
      if (fileName.endsWith('bg') || fileName.endsWith('background')) {
        fallbackBg = fileName;
        console.log(`Set ${fallbackBg} as fallback background`);
        console.log('Reason: file name ends with bg/background');
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

  // if there is still nothing found, just set to empty string
  if (!fallbackBg || !fallbackBanner) {
    fallbackBanner ||= '';
    fallbackBg ||= '';
  }

  console.log('Finished searching for fallback banner and background');

  // if there is nothing at all, halt execution (not sure if this should be in yet)
  // if (!fallbackBg && !fallbackBanner) {
  //   throw new ParserException('No images found for fallback banner or background.', '');
  // }

  console.log('Beginning song folder iteration');
  // iterate through song folders one by one, look at the SM and cross reference
  // their desired banner URL to see if it exists or not.
  // if it does not exist, assign fallbacks if those exist.
  for (let songFolder of songFolders) {
    const contents = fs.readdirSync(rootDir + '/' + songFolder);
    for (let file of contents) {
      if (file.endsWith('.sm') || file.endsWith('.ssc')) {
        const fileDir = rootDir + '/' + songFolder + '/' + file;
        const fileData = iconvlite.decode(fs.readFileSync(fileDir), 'utf8').split('\n');

        console.log(`${fileDir} opened`)
        for (let i in fileData) {
          const line = fileData[i];
          if (line === '#BANNER:;') {
            console.log('No banner detected in file, inserting fallback banner');
            fileData[i] = `#BANNER:../${fallbackBanner}`;
            console.log(`Fallback banner ${fallbackBanner} inserted`);
          } else if (line.startsWith('#BANNER:')) {
            const existingBnUrl = fileData[i].slice(8, -1);
            const bnUrlParts = existingBnUrl.split('/');
            let supposedBnName;
            if (bnUrlParts.length > 1) {
              supposedBnName = bnUrlParts[bnUrlParts.length - 1];
            } else {
              supposedBnName = existingBnUrl.slice(3);
            }
            let supposedBnDir;

            //check banner url and trace based on how many subdirs it has
            // not sure if this is comprehensive since it just checks for '/'
            console.log('Checking existing Banner URL');

            if (existingBnUrl.startsWith('../') && bnUrlParts.length === 2) {
              supposedBnDir = rootDir;
            } else {
              const bnParts = bnUrlParts.slice(1, -1).join('/');
              supposedBnDir = rootDir + '/' + bnParts;
            }

            console.log(`Banner folder found: ${supposedBnDir}`);
            const supposedBnFolder = fs.readdirSync(supposedBnDir + '/');

            // if the supposed directory is empty, throw error
            if (!supposedBnFolder.length) {
              throw new ParserException(`${supposedBnDir} is empty, aborting.`, file);
            }

            // check what the current file says the banner should be
            // correct name if needed
            if (supposedBnFolder.includes(supposedBnName)) {
              console.log('Banner found! Checking image aspect ratio');

              const { width, height } = size(supposedBnDir + '/' + supposedBnName);
              const supposedBnAr = findAspectRatio(width, height);
              if (supposedBnAr !== '64:25') {
                console.log(`${supposedBnName} aspect ratio is not 2.56:1`);
              } else {
                console.log(`${supposedBnName}'s aspect ratio is correct`);
              };
            } else {
              console.log('Banner not found! Searching for suitable replacement');

              let bannerChosen = false;
              // go through the location pointed to, and check for similarity between
              // filenames
              const smBnDir = bnUrlParts.slice(0, -1).join('/') + '/';
              for (let bnFolderFile of supposedBnFolder) {
                if (compareChars(supposedBnName, bnFolderFile) < 3) {
                  if (!readline.keyInYNStrict(`Do you want to use ${bnFolderFile} for ${file}?`)) continue;
                  fileData[i] = `#BANNER:${smBnDir + bnFolderFile};`;
                  console.log(`Using ${bnFolderFile} as banner for ${file}`);
                  bannerChosen = true;
                  break;
                }
              }

              // if even after checking, there is still no banner but a fallback
              // was found, replace it with fallback
              if (!bannerChosen && fallbackBanner) {
                console.log(`No suitable banner found in supposed directory, using fallback banner instead.`)
                fileData[i] = `#BANNER:../${fallbackBanner}`;
              }
            }
          }
          if (line === '#BACKGROUND:;' && fallbackBg) {
            console.log('Inserting fallback background');
            fileData[i] = `#BACKGROUND:../${fallbackBg};`;
            console.log(`Fallback background ${fallbackBg} inserted`);
          } else if (line.startsWith('#BACKGROUND:')) {
            const existingBgUrl = fileData[i].slice(12, -1);
            const bgUrlParts = existingBgUrl.split('/');
            let supposedBgName;
            if (bgUrlParts.length > 1) {
              supposedBgName = bgUrlParts[bgUrlParts.length - 1];
            } else {
              supposedBgName = existingBgUrl.slice(3);
            };
            let supposedBgDir;

            // check background url and trace based on how many subdirs it has
            // not sure if this is comprehensive since it just checks for '/'
            console.log('Checking existing Background Url');

            if (existingBgUrl.startsWith('../') && bgUrlParts.length === 2) {
              supposedBgDir = rootDir;
            } else {
              const bgParts = bgUrlParts.slice(1, -1).join('/');
              supposedBgDir = rootDir + '/' + bgParts;
            }

            console.log(`Background folder found: ${supposedBgDir}`);
            const supposedBgFolder = fs.readdirSync(supposedBgDir + '/');

            // if the supposed directory is empty, throw error
            if (!supposedBgFolder.length) {
              throw new ParserException(`${supposedBgDir} is empty, aborting.`, file);
            }

            // set and declare what the current file says the banner should be
            // check for existence
            // correct name if needed
            if (supposedBgFolder.includes(supposedBgName)) {
              console.log(`${file}'s designated background found, continuing.`);
            } else {
              console.log('Background not found! Searching for a suitable replacement');

              let backgroundChosen = false;
              // go through location pointed to, and check for similarity between
              // filenames, only asking for similarly named files
              const smBgDir = bgUrlParts.slice(0, -1).join('/') + '/';
              for (let bgFolderFile of supposedBgFolder) {
                if (compareChars(supposedBgName, bgFolderFile) < 3) {
                  if (!readline.keyInYNStrict(`Do you want to use ${bgFolderFile} for ${file}?`)) continue;
                  fileData[i] = `#BACKGROUND:${smBgDir + bgFolderFile};`;
                  console.log(`Using ${bgFolderFile} as background for ${file}`);
                  backgroundChosen = true;
                  break;
                }
              }

              // if even after checking, there is still no banner but a fallback
              // was found, replace it with fallback
              if (!backgroundChosen && fallbackBg) {
                console.log(`No suitable background found in supposed directory, using fallback background instead.`)
                fileData[i] = `#BACKGROUND:../${fallbackBg};`;
              }
            }
          }

          // during iteration, if the notes are reached, break
          if (line.startsWith('//')) {
            console.log(`Finished parsing metadata for ${file}`);
            break
          }
        }

        const saveData = fileData.join('\n');

        console.log(`Saving ${file}`);
        fs.writeFileSync(fileDir, saveData);
      }
    }
  }

  console.log('Execution finished for now');
} catch (error) {
  if (error.name) {
    switch (error.name) {
      case 'ParserException':
        console.log('There was an error while parsing ' + `${error.fileName}`)
        console.log(error.message);
        break;
      case 'WriterException':
        console.log('There was an error while editing ' + `${error.fileName}`)
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