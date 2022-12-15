const fs = require("fs");
const size = require("image-size");
const iconvlite = require("iconv-lite");
const readline = require("readline-sync");

// Change this to your desired pack directory with no / at the end
// windows: 'C:/Games/Stepmania 5/Stamina RPG 6'
// macOSX: '/Users/jonmbp/Desktop/shit'
const rootDir = "C:/Users/China/Desktop/b2";

// Banner aspect ratio should be 2.56:1
// Background aspect ratios can be 4:3, 16:9, 16:10, 5:4
const IMAGE_FILENAME_EXTENSIONS = [".png", ".jpeg", ".jpg", ".mp4"];

function ParserException(message, fileName) {
  this.fileName = fileName;
  this.message = message;
  this.name = "ParserException";
}

function WriterException(message, fileName) {
  this.fileName = fileName;
  this.message = message;
  this.name = "WriterException";
}

// recursive GCD function helper
function greatestCommonDenominator(a, b = 0) {
  if (b === 0) return a;
  return greatestCommonDenominator(b, a % b);
}

function findAspectRatio(w, h) {
  if (!w || !h) throw "error with file dimensions";
  const gcd = greatestCommonDenominator(w, h);
  const width = w / gcd;
  const height = h / gcd;
  return width / height;
}

function checkAspectRatio(ratio) {
  let val = 2.56 - ratio;
  if (val < 0) val = -val;
  return val < 0.2;
}

function findAndCheckAr(file) {
  const { width, height } = size(file);
  const ar = findAspectRatio(width, height);
  return checkAspectRatio(ar);
}

function checkIfImage(string) {
  for (let extension of IMAGE_FILENAME_EXTENSIONS) {
    if (string.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

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

  const newCount = Object.values(count).filter((value) => value !== 0);
  let sum = 0;
  for (let num of newCount) {
    if (num < 0) num *= -1;
    if (num) sum += num;
  }

  return sum;
}

function getSongFoldersFiles(songFolderItems) {
  const songFolders = [];
  const files = [];

  for (let i = 0; i < songFolderItems.length; i++) {
    const path = rootDir + "/" + songFolderItems[i];
    console.log(`Currently on: ${songFolderItems[i]}`);

    // if current file is a directory (a song folder), add to array
    // if it is not a directory, it is either an image or file within folder
    if (fs.statSync(path).isDirectory()) {
      console.log(`Adding ${songFolderItems[i]} to songFolders`);
      songFolders.push(songFolderItems[i]);
    } else {
      console.log(`Adding ${songFolderItems[i]} to files`);
      files.push(songFolderItems[i]);
    }
  }

  return { songFolders, files };
}

function getFallbackImages(files) {
  const images = [];
  let fallbackBanner;
  let fallbackBg;

  for (let fileName of files) {
    // if file is an image, check it's aspect ratio and set it to either banner or bg
    if (checkIfImage(fileName)) {
      if (images.push(fileName)) {
        console.log(`Adding ${fileName} to images`);
      }

      // if it's a banner aspect ratio, set banner variable i.e. './shitbanner.png'
      if (findAndCheckAr(rootDir + "/" + fileName) && !fallbackBanner) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log("Reason: Aspect ratio matched 2.56:1 / 64:25");
        continue;
      }

      // catch edge cases where aspect ratio might not fit but has name designation
      if (fileName.endsWith("bn") || fileName.endsWith("banner")) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner`);
        console.log("Reason: file name ends with bn/banner");
      }

      if (fileName.endsWith("bg") || fileName.endsWith("background")) {
        fallbackBg = fileName;
        console.log(`Set ${fallbackBg} as fallback background`);
        console.log("Reason: file name ends with bg/background");
      }
    }
  }

  return { images, fallbackBanner, fallbackBg };
}

function getSimilarFiles(dir, target) {
  const dirFiles = fs.readdirSync(dir);
  const similarFiles = [];

  for (let file of dirFiles) {
    if (compareChars(file, target) < 3) {
      similarFiles.push(file);
    }
  }

  if (!dirFiles.length) {
    throw new ParserException(`${dir} is empty/incorrect, aborting.`, target);
  }

  return similarFiles;
}

function getInsertSearchUrl(songFolderName, url, urlParts) {
  let insertUrl;
  let searchDir;

  if (urlParts.length === 1) {
    // image is in songfolder
    searchDir = rootDir + "/" + songFolderName + "/";
    insertUrl = "";
  } else if (url.startsWith("../") && urlParts.length === 2) {
    // image is in root folder (1 level up from songfolder)
    searchDir = rootDir;
    insertUrl = "../";
  } else {
    // image is elsewhere
    searchDir = rootDir + "/" + urlParts.slice(1, -1).join("/");
    insertUrl = urlParts.slice(0, -1).join("/") + "/";
    // theoretically this should look like '../assets/'
  }

  return [insertUrl, searchDir];
}

try {
  console.log("Script starting...");
  // get all files/folders within specified directory in an array
  let songFolderItems = fs.readdirSync(rootDir);

  console.log("Iterating through main directory now");
  // populate songFolders array and files array
  const { songFolders, files } = getSongFoldersFiles(songFolderItems);

  console.log("Finished iterating through main directory");
  // look through the files for images, for fallback banner and bg
  // while sorting out all the extraneous files
  let { images, fallbackBanner, fallbackBg } = getFallbackImages(files);

  console.log("Successfully checked for fallback banner and background");

  // if the banner is found, remove it from images array
  if (fallbackBanner) {
    images = images.filter((image) => image !== fallbackBanner);
  }

  // if there is no fallback background yet and images array has something, set as fallback bg
  if (!fallbackBg && images.length) {
    fallbackBg = images[0];
    console.log(`Set ${fallbackBg} as fallback background`);
    console.log(
      "Reason: No distinct fallback bg found, defaulting to first non-banner image"
    );
  }

  // if there is still nothing found, just set to empty string
  fallbackBanner ||= "";
  fallbackBg ||= "";

  console.log("Finished searching for fallback banner and background");

  console.log("Beginning song folder iteration");
  // iterate through song folders one by one, look at the SM and cross reference
  // their desired banner URL to see if it exists or not.
  // if it does not exist, assign fallbacks if those exist.
  for (let songFolderName of songFolders) {
    const contents = fs.readdirSync(rootDir + "/" + songFolderName);
    for (let fileName of contents) {
      if (fileName.endsWith(".sm") || fileName.endsWith(".ssc")) {
        const stepFileDir = rootDir + "/" + songFolderName + "/" + fileName;
        const fileData = iconvlite
          .decode(fs.readFileSync(stepFileDir), "utf8")
          .split("\n");
        console.log(`${fileName} opened`);

        let bannerChosen = false;
        let chosenBannerName;
        let bgChosen = false;
        let fileChanged = false;
        // find and navigate first, then check if proper. if proper, continue to check for bg
        // if not proper, set fallback
        for (let i in fileData) {
          const currLine = fileData[i];
          if (currLine.startsWith("#BANNER:")) {
            console.log("Looking at banner assignment");
            const bnLineUrl = currLine.slice(8, -1);
            const bnUrlParts = bnLineUrl.split("/");
            const smBnName = bnUrlParts[bnUrlParts.length - 1];

            const [bnInsertUrl, bnSearchDir] = getInsertSearchUrl(
              songFolderName,
              bnLineUrl,
              bnUrlParts
            );

            // if bannerless, check from inner folder first and set banner from inside.
            if (currLine === '#BANNER:;') {
              console.log(`Banner line empty, looking within songfolder.`)
              const folderDir = rootDir + '/' + songFolderName + '/';
              const folderFiles = fs.readdirSync(folderDir);
              for (let folderFile of folderFiles) {
                const fileDir = folderDir + folderFile;
                if (findAndCheckAr(fileDir)) {
                  console.log(`Suitable banner found! Assigning ${folderFile} as banner.`)
                  fileData[i] = `#BANNER:${folderFile};`;
                  bannerChosen = true;
                  fileChanged = true;
                  chosenBannerName = folderFile;
                  break;
                }
              }
            }

            if (bannerChosen) continue;

            const bnSearchResults = getSimilarFiles(bnSearchDir, smBnName);
            // if the .sm points to a folder that contains the file it says it does, move on
            // set flag so fallback is not assigned to this file

            if (bnSearchResults.includes(smBnName)) {
              console.log(
                `Banner for ${fileName} is where specified in .sm/.ssc, checking aspect ratio.`
              );
              const { width, height } = size(bnSearchDir + "/" + smBnName);
              const smBannerAr = findAspectRatio(width, height);
              if (!checkAspectRatio(smBannerAr))
                console.log(`Aspect ratio incorrect.`);
              console.log(`Aspect ratio correct, continuing.`);
              bannerChosen = true;
              continue;
            }

            // now that we've checked through the specified destination and not found anything
            // we can check for similar files.
            if (!bannerChosen) {
              for (let searchResult of bnSearchResults) {
                if (compareChars(searchResult, smBnName) < 3) {
                  if (
                    readline.keyInYNStrict(
                      `Do you want to use ${searchResult} as the banner for ${fileName}?`
                    )
                  ) {
                    fileData[i] = `#BANNER:${bnInsertUrl + searchResult};`;
                    bannerChosen = true;
                    fileChanged = true;
                    break;
                  }
                }
              }
            }

            // when all else fails, if a fallback exists, apply it
            if (!bannerChosen && fallbackBanner) {
              console.log(
                `No suitable banner found for ${fileName}, using fallback.`
              );
              fileData[i] = `#BANNER:../${fallbackBanner};`;
              fileChanged = true;
            }
          }

          if (currLine.startsWith("#BACKGROUND:")) {
            const bgLineUrl = currLine.slice(12, -1);
            const bgUrlParts = bgLineUrl.split("/");
            const smBgName = bgUrlParts[bgUrlParts.length - 1];

            const [bgInsertUrl, bgSearchDir] = getInsertSearchUrl(
              songFolderName,
              bgLineUrl,
              bgUrlParts
            );

            // if background line is empty, find and set background within songfolder first.
            if (currLine === '#BACKGROUND:;') {
              console.log(`Background line empty, looking within songfolder.`)
              const folderDir = rootDir + '/' + songFolderName + '/';
              const folderFiles = fs.readdirSync(folderDir);
              for (let folderFile of folderFiles) {
                const fileDir = folderDir + folderFile;
                if (!findAndCheckAr(fileDir)) {
                  console.log(`Suitable background found! Assigning ${folderFile} as background.`)
                  fileData[i] = `#BACKGROUND:${folderFile};`;
                  bgChosen = true;
                  fileChanged = true;
                  break;
                }
              }
            }

            if (bgChosen) continue;

            const bgSearchResults = getSimilarFiles(bgSearchDir, smBgName);
            // if the .sm points to a folder that contains the file it says it does, move on
            // set flag so fallback is not assigned to this file
            if (bgSearchResults.includes(smBgName)) {
              console.log(
                `Background for ${fileName} is where specified in .sm/.ssc, continuing.`
              );
              bgChosen = true;
              continue;
            }

            // now that we've checked through the specified destination and not found anything
            // we can check for similar files.
            if (!bgChosen) {
              for (let searchResult of bgSearchResults) {
                if (compareChars(searchResult, smBgName) < 3) {
                  if (
                    readline.keyInYNStrict(
                      `Do you want to use ${searchResult} as the background for ${fileName}?`
                    )
                  ) {
                    fileData[i] = `#BANNER:${bgInsertUrl + searchResult};`;
                    bgChosen = true;
                    fileChanged = true;
                    break;
                  }
                }
              }
            }

            // when all else fails, if a fallback exists, apply it
            if (!bgChosen && fallbackBg) {
              console.log(
                `No suitable background found for ${fileName}, using fallback.`
              );
              fileData[i] = `#BACKGROUND:../${fallbackBg};`;
              fileChanged = true;
            }
          }
        }

        if (fileChanged) {
          console.log(`Changes were made to ${fileName}, saving...`);
          const saveData = fileData.join("\n");

          console.log(`Saving ${fileName}`);
          fs.writeFileSync(stepFileDir, saveData);
        } else {
          console.log(`No changes were made to ${fileName}`)
        }
      }
    }
  }

  console.log("Execution finished for now");
} catch (error) {
  if (error.name) {
    switch (error.name) {
      case "ParserException":
        console.log(`There was an error while parsing ${error.fileName}`);
        console.log(error.message);
        break;
      case "WriterException":
        console.log(`There was an error while writing to ${error.fileName}`);
        console.log(error.message);
        break;
      default:
        console.log("An unspecified error has occured, halting execution");
        console.log(`error: ${error}`);
        break;
    }
  } else {
    console.log("An unexpected error has occured, halting execution");
    console.log(`error: ${error}`);
  }
}
