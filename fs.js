const fs = require("fs");
const size = require("image-size");
const iconvlite = require("iconv-lite");
const readline = require("readline-sync");
const getVideoDimensions = require("get-video-dimensions");

/* Change this to your desired pack directory with no / at the end
Windows: 'C:/Games/Stepmania 5/Stamina RPG 6'
macOSX: '/Users/jonmbp/Desktop/shit' */
// const rootDir = "C:/Users/China/Desktop/shit";
let rootDir;
let dirSelected = false;
while (!dirSelected) {
  rootDir = readline.question('Please enter the songfolder directory. (ex. C:/Users/user123/Desktop/songfolder) \n');
  rootDir = rootDir.split("\\").join("/");

  if (readline.keyInYNStrict(`Is ${rootDir} the correct directory?`)) {
    dirSelected = true;
  };
};

/* Background aspect ratios can be 4:3, 16:9, 16:10, 5:4 but for now we're not
  checking those */
const IMAGE_FILENAME_EXTENSIONS = [".png", ".jpeg", ".jpg", ".mp4"];
// Banner aspect ratio should be 2.56:1
const DESIRED_BANNER_ASPECT_RATIO = 2.56;
// We want 2.36 < aspect ratio < 2.76
const DESIRED_BANNER_AR_TOLERANCE = 0.2;

/*------------------------------------------------------------------------------
EXCEPTION "CLASSES"
------------------------------------------------------------------------------*/

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

/*------------------------------------------------------------------------------
HELPERS
------------------------------------------------------------------------------*/

// Recursive GCD function helper
function greatestCommonDenominator(a, b = 0) {
  if (b === 0) return a;
  return greatestCommonDenominator(b, a % b);
}

// Finds aspect ratio of an image in a decimal.
function findAspectRatio(w, h) {
  if (!w || !h) throw "error with file dimensions";
  const gcd = greatestCommonDenominator(w, h);
  const width = w / gcd;
  const height = h / gcd;
  return width / height;
}

// Function to compare aspect ratio float with desired one for banners (2.56)
function checkAspectRatio(ratio) {
  let val = DESIRED_BANNER_ASPECT_RATIO - ratio;
  if (val < 0) val = -val;
  return val < DESIRED_BANNER_AR_TOLERANCE;
}

/* Accepts a filename as a string, and checks the ending against the
  image filename extensions constant */
function checkIfImage(string) {
  for (let extension of IMAGE_FILENAME_EXTENSIONS) {
    if (string.toLowerCase().endsWith(extension)) {
      return true;
    }
  }
  return false;
}

/* Accepts a URL, and uses image-size to get the dimensions of an image file.
  returns false if file is not an image for redundancy. */
async function findAndCheckAr(file) {
  if (!checkIfImage(file)) return false;

  let ar;

  if (file.endsWith(".mp4")) {
    const { width, height } = await getVideoDimensions(file);
    ar = findAspectRatio(width, height);
  } else {
    const { width, height } = size(file);
    ar = findAspectRatio(width, height);
  }
  return checkAspectRatio(ar);
}

// compares two strings, returning the number of different characters between them.
// forces lowercase checking
function compareChars(string1, string2) {
  if (!string1 || !string2) return Infinity;
  const count = {};
  const lowerStr1 = string1.toLowerCase();
  const lowerStr2 = string2.toLowerCase();

  for (let char of lowerStr1) {
    count[char] ||= 0;
    count[char]++;
  }

  for (let char of lowerStr2) {
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

/* I hate this so much.
  For some reasons certain packs have certain line endings in their .sm/.ssc files
  might be operating system based and I'm not sure of a better way to check and split
  the fetched filedata with it, so this is a brute-force approach.
  Function to take in a data string from a file. File is read with iconvlite,
  decoded from utf-8, and put into a string. That string is then passed into
  this function that splits it into an array, so we can iterate the lines
  and mutate them. */
function splitFile(data) {
  let arr = data.split("\n");
  if (arr[0].endsWith("\r")) {
    arr = data.split("\r\n");
  }
  return arr;
}

// Function to save and write to file
function saveChanges(dir, fileData, fileName) {
  console.log(`Changes were made to ${fileName}, saving...`);
  const saveData = fileData.join("\n");

  console.log(`Saving ${fileName}`);
  fs.writeFileSync(dir, saveData);
}

/*------------------------------------------------------------------------------
MODULES
------------------------------------------------------------------------------*/

/* Accepts an array of song folder items, fetched by fs.readdirSync called on
  rootDir. Returns an object of two arrays which are the songFolders and Files
  from rootDir. */
function getSongFoldersFiles(songFolderItems) {
  const songFolders = [];
  const files = [];

  for (let i = 0; i < songFolderItems.length; i++) {
    const path = rootDir + "/" + songFolderItems[i];
    console.log(`Currently on: ${songFolderItems[i]}`);

    /* If current file is a directory (a song folder), add it to the array.
      If it is not a directory, it is either an image or file within the folder. */
    if (fs.statSync(path).isDirectory()) {
      console.log(`Adding ${songFolderItems[i]} to songFolders.`);
      songFolders.push(songFolderItems[i]);
    } else {
      console.log(`Adding ${songFolderItems[i]} to files.`);
      files.push(songFolderItems[i]);
    }
  }

  return { songFolders, files };
}

/* Accepts an array of filenames fetched from fs.readdirSync. Sets
  two variables, one fallbackBanner, one fallbackBg from images found within
  rootDir. Also returns an array of image names. */
function getFallbackImages(files) {
  const images = [];
  let fallbackBanner;
  let fallbackBg;

  for (let fileName of files) {
    /* If the file is an image, check its aspect ratio and set it to either
      a banner (if the aspect ratio is correct), or a background */
    if (checkIfImage(fileName)) {
      if (images.push(fileName)) {
        console.log(`Adding ${fileName} to images.`);
      }

      /* If the file has the aspect ratio of a banner, and fallbackBanner
        has not been set, set fallbackBanner to the current file */
      if (findAndCheckAr(rootDir + "/" + fileName) && !fallbackBanner) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner.`);
        console.log(
          `Reason: Aspect ratio matched ${DESIRED_BANNER_ASPECT_RATIO}`
        );
        continue;
      }

      // Catch edge cases where files are designated by name
      if (fileName.endsWith("bn") || fileName.endsWith("banner")) {
        fallbackBanner = fileName;
        console.log(`Set ${fallbackBanner} as fallback banner.`);
        console.log("Reason: file name ends with bn/banner.");
      }

      if (fileName.endsWith("bg") || fileName.endsWith("background")) {
        fallbackBg = fileName;
        console.log(`Set ${fallbackBg} as fallback background.`);
        console.log("Reason: file name ends with bg/background.");
      }
    }
  }

  return { images, fallbackBanner, fallbackBg };
}

/* Takes in a directory (string), and a target file name (string), reads the
  directory and returns an array of files with names similar to the target.
  Raises an exception if the directory is empty or incorrect.  */
function getSimilarFiles(dir, target) {
  const dirFiles = fs.readdirSync(dir);
  const similarFiles = [];

  if (!dirFiles.length) {
    throw new ParserException(`${dir} is empty/incorrect, aborting.`, target);
  }

  for (let file of dirFiles) {
    if (compareChars(file, target) < 3) {
      similarFiles.push(file);
    }
  }

  return similarFiles;
}

/* Takes in a song folder's name (string), url (string), and it's parts (array).
  returns two modified strings based on how many levels nested.
  i.e. '../assets/banner.png' or '../fallback.png' */
function getInsertSearchUrl(songFolderName, url, urlParts) {
  let insertUrl;
  let searchDir;

  if (urlParts.length === 1) {
    // Image is in songfolder
    searchDir = rootDir + "/" + songFolderName + "/";
    insertUrl = "";
  } else if (url.startsWith("../") && urlParts.length === 2) {
    // Image is in the root folder (1 level up from songfolder)
    searchDir = rootDir;
    insertUrl = "../";
  } else {
    // Image is elsewhere within the root directory
    searchDir = rootDir + "/" + urlParts.slice(1, -1).join("/");
    insertUrl = urlParts.slice(0, -1).join("/") + "/";
    // Theoretically this should look like '../assets/'
  }

  return [insertUrl, searchDir];
}

//------------------------------------------------------------------------------
// SCRIPT BEGINS HERE
//------------------------------------------------------------------------------

try {
  console.log(`Script starting in ${rootDir}...`);
  // Get all files/folders within specified directory in an array
  let songFolderItems = fs.readdirSync(rootDir);

  console.log("Iterating through main directory.");
  // Populate songFolders array and files array
  const { songFolders, files } = getSongFoldersFiles(songFolderItems);

  console.log("Finished iterating through main directory.");
  /* Look through the files for images, for fallback banner and bg
  while sorting out all the extraneous files */
  let { images, fallbackBanner, fallbackBg } = getFallbackImages(files);

  console.log("Successfully checked for fallback banner and background.");

  // If the banner is found, remove it from the images array
  if (fallbackBanner) {
    images = images.filter((image) => image !== fallbackBanner);
  }

  /* If there is no fallback background yet and the images array is not empty,
    set the first element as the fallbackBg */
  if (!fallbackBg && images.length) {
    fallbackBg = images[0];
    console.log(`Set ${fallbackBg} as fallback background.`);
    console.log(
      "Reason: No distinct fallback bg found, defaulting to first non-banner image."
    );
  }

  // If there is still nothing found, just set both fallbacks to an empty string.
  fallbackBanner ||= "";
  fallbackBg ||= "";

  console.log("Finished searching for fallback banner and background.");

  console.log("Beginning song folder iteration.");
  /* Iterate through song folders one by one, look at the .sm and cross reference
    their desired banner URL to see if it exists or not.
    If it does not exist, assign fallbacks if those exist. */
  for (let songFolderName of songFolders) {
    const contents = fs.readdirSync(rootDir + "/" + songFolderName);
    for (let fileName of contents) {
      if (fileName.endsWith(".sm") || fileName.endsWith(".ssc")) {
        const stepFileDir = rootDir + "/" + songFolderName + "/" + fileName;
        const fileData = splitFile(
          iconvlite.decode(fs.readFileSync(stepFileDir), "utf8")
        );
        console.log(`${fileName} opened.`);

        const folderDir = rootDir + "/" + songFolderName + "/";

        let bannerChosen = false;
        let chosenBannerName;
        let bgChosen = false;
        let fileChanged = false;
        /* Iterate through the lines of fileData (the .sm/.ssc file) until 
          either the #BANNER or #BACKGROUND lines. Validate and set banners and
          backgrounds once found. */
        for (let i in fileData) {
          const currLine = fileData[i];
          if (currLine.startsWith("#BANNER:")) {
            // If bannerless, check and prioritize images within songfolder.
            console.log(`Looking within song folder for banner.`);
            const folderFiles = fs.readdirSync(folderDir);
            for (let folderFile of folderFiles) {
              if (!checkIfImage(folderFile)) continue;

              const fileDir = folderDir + folderFile;
              if (findAndCheckAr(fileDir)) {
                console.log(
                  `Suitable banner found! Assigning ${folderFile} as banner.`
                );
                fileData[i] = `#BANNER:${folderFile};`;
                bannerChosen = true;
                fileChanged = true;
                chosenBannerName = folderFile;
                break;
              }
            }

            if (bannerChosen) continue;

            // If there is a banner assigned already, follow the URL.
            console.log("Looking at banner assignment.");
            const bnLineUrl = currLine.slice(8, -1);
            const bnUrlParts = bnLineUrl.split("/");
            const smBnName = bnUrlParts[bnUrlParts.length - 1];

            const [bnInsertUrl, bnSearchDir] = getInsertSearchUrl(
              songFolderName,
              bnLineUrl,
              bnUrlParts
            );

            // Check the location for the supposed file.
            const bnSearchResults = getSimilarFiles(bnSearchDir, smBnName);
            if (bnSearchResults.includes(smBnName)) {
              console.log(
                `Banner for ${fileName} is where specified in .sm/.ssc, checking aspect ratio.`
              );
              if (findAndCheckAr(bnSearchDir + "/" + smBnName)) {
                console.log(`Aspect ratio correct, continuing.`);
                bannerChosen = true;
                continue;
              }
              console.log(`Aspect ratio incorrect.`);
            }
            /* Now that we've checked through the specified destination and
              haven't found anything, we can check for similar files. */
            if (!bannerChosen) {
              for (let searchResult of bnSearchResults) {
                if (checkIfImage(searchResult) && compareChars(searchResult, smBnName) < 3) {
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

            // When all else fails, if a fallback exists, apply it.
            if (!bannerChosen && fallbackBanner) {
              console.log(
                `No suitable banner found for ${fileName}, using fallback.`
              );
              fileData[i] = `#BANNER:../${fallbackBanner};`;
              fileChanged = true;
            }
          }

          if (currLine.startsWith("#BACKGROUND:")) {
            // If backgroundless, check and prioritize images within songfolder.
            console.log(`Looking within songfolder for background.`);
            const folderFiles = fs.readdirSync(folderDir);
            for (let folderFile of folderFiles) {
              if (!checkIfImage(folderFile)) continue;

              const fileDir = folderDir + folderFile;
              if (!findAndCheckAr(fileDir)) {
                console.log(
                  `Suitable background found! Assigning ${folderFile} as background.`
                );
                fileData[i] = `#BACKGROUND:${folderFile};`;
                bgChosen = true;
                fileChanged = true;
                break;
              }
            }

            if (bgChosen) continue;

            // If there is a background assigned already, follow the URL.
            console.log("Looking at background assignment.");
            const bgLineUrl = currLine.slice(12, -1);
            const bgUrlParts = bgLineUrl.split("/");
            const smBgName = bgUrlParts[bgUrlParts.length - 1];

            const [bgInsertUrl, bgSearchDir] = getInsertSearchUrl(
              songFolderName,
              bgLineUrl,
              bgUrlParts
            );

            // Check the location for the supposed file.
            const bgSearchResults = getSimilarFiles(bgSearchDir, smBgName);
            if (bgSearchResults.includes(smBgName)) {
              console.log(
                `Background for ${fileName} is where specified in .sm/.ssc, continuing.`
              );
              bgChosen = true;
              continue;
            }

            /* Now that we've checked through the specified destination and
              haven't found anything, we can check for similar files. */
            if (!bgChosen) {
              for (let searchResult of bgSearchResults) {
                if (checkIfImage(searchResult) && compareChars(searchResult, smBgName) < 3) {
                  if (
                    readline.keyInYNStrict(
                      `Do you want to use ${searchResult} as the background for ${fileName}?`
                    )
                  ) {
                    fileData[i] = `#BACKGROUND:${bgInsertUrl + searchResult};`;
                    bgChosen = true;
                    fileChanged = true;
                    break;
                  }
                }
              }
            }

            // When all else fails, if a fallback exists, apply it
            if (!bgChosen && fallbackBg) {
              console.log(
                `No suitable background found for ${fileName}, using fallback.`
              );
              fileData[i] = `#BACKGROUND:../${fallbackBg};`;
              fileChanged = true;
            }
          }

          if (currLine.startsWith("//")) {
            console.log(`Finished parsing metadata.`);
            break;
          }
        }
        if (fileChanged) {
          saveChanges(stepFileDir, fileData, fileName);
        } else {
          console.log(`No changes were made to ${fileName}`);
        }
      }
    }
  }

  console.log("Execution finished");
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
        console.log("An unspecified error has occured, halting execution.");
        console.log(`error: ${error}`);
        break;
    }
  } else {
    console.log("An unexpected error has occured, halting execution.");
    console.log(`error: ${error}`);
  }
}
