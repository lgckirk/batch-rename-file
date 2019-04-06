const fs = require('fs');
const { spawn } = require('child_process');
const readLine = require('readline');
const uniqName = require('unique-filename');
const os = require('os');

// msg file's name
const msgFileName = uniqName(os.tmpdir(), 'batch-rename-msg');

// argument parsing
if (process.argv.length != 3) {
    console.error("Usage: node batch-rename.js ${path}.");
    process.exit(1);
}
let targetPath = process.argv[2]; // path to the target directory
if (!fs.lstatSync(targetPath).isDirectory()) {
    console.error(`"${targetPath}" is not a valid directory.`);
    process.exit(1);
}

// normalize target directory path
if (targetPath.charAt(targetPath.length-1) === '/') {
    targetPath = targetPath.slice(0, targetPath.length-1);
}

// get files in the target directory
const dirContent = getDirContent(targetPath); // file names in the target directory
initMsgFile(msgFileName, dirContent);

// register message file clean up callback
process.on('exit', code => {
    fs.unlinkSync(msgFileName);
});

// open text editor
const vim = spawn('vi', [msgFileName], {
    stdio: 'inherit'
});

// do rename after text editor is closed
vim.on('exit', (code, signal) => {
    if (code === 0 && signal === null) {
        processMsgFile(msgFileName, dirContent);
    } else {
        console.error(`Text editor stopped unsuccessfully. Code: ${code}, Signal: ${signal}`);
    }
});

function initMsgFile(msgFileName, targetFNames) {
    const instruction = "# Batch file rename instruction:\n"
        + "# format: ${old file name} ${new file name}\n"
        + "# a comment line starts with a '#' character\n\n"
        + `# files under "${targetPath}":\n`;

    const data = targetFNames.reduce((msg, fName) => {
        return msg + fName + "\n";
    }, instruction);

    try {
        fs.writeFileSync(msgFileName, data, { flag: 'a' });
    } catch (err) {
        console.error(`An error has occurred when initializing the message file. Error: ${err.message}`);
        process.exit(1);
    }
}

function processMsgFile(msgFileName, targetFNames) {
    const scanner = readLine.createInterface({
        input: fs.createReadStream(msgFileName),
        crlfDelay: Infinity
    });
    // todo: report skipped lines and failed rename
    scanner.on('line', (line) => {
        if (line.charAt(0) != '#') {
            const namePair = line.split(/[ #]+/);
            if (namePair.length < 2) {
                return;
            }
            const oldFName = namePair[0];
            const newFName = namePair[1];
            if (targetFNames.includes(oldFName)) {
                try {
                    fs.renameSync(
                        `${targetPath}/${oldFName}`,
                        `${targetPath}/${newFName}`
                    );
                } catch (err) {}
            }
        }
    });
}

// synchronous function
// only get regular file, directory, or symlink
function getDirContent(dirName) {
    const ret = [];
    fs.readdirSync(dirName)
    .forEach(fName => {
        const stat = fs.lstatSync(`${dirName}/${fName}`);
        if (stat.isFile() || stat.isSymbolicLink() || stat.isDirectory()) {
            ret.push(fName);
        }
    });
    return ret;
}