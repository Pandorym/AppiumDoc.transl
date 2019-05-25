#!/usr/bin/env node

import *as fs from 'fs';
import *as path from 'path';
import { execSync } from 'child_process';
import *as program from 'commander';
import { table } from 'table';

let config = {
    repoUrl : 'https://github.com/Pandorym/appium.git',
    repoPath : './appium',
    docPath : './appium/docs',
    longHash : false,
    showCommands : false,
    onlyShowCommands : false,
    targetLang : 'cn',
};

function main() {

    if (!hasAppiumRepo()) cloneAppiumRepo();

    showToc(parseToc('en'), parseToc(config.targetLang), 'en', config.targetLang);
}

function hasAppiumRepo(): boolean {
    return fs.existsSync(path.join(__dirname, config.repoPath, '.git'));
}

function cloneAppiumRepo(): void {
    fs.mkdirSync(path.join(__dirname, config.repoPath));
    execSync('git clone ' + config.repoUrl, { cwd : __dirname });

}

function getDocLastVersion(file): string {
    let listLine = fs.readFileSync(path.join(__dirname, config.docPath, file)).toString().split('\n').slice(-2)[0];
    if (listLine.startsWith('Last english version: ')) return listLine.substr(22, 40);

    return ' ';


}

function getFileLastCommit(file): string {
    return execSync('git log --pretty=oneline docs/' + file, { cwd : path.join(__dirname, config.repoPath) })
        .toString().substr(0, 40);
}

function parseToc(origin: string): object {
    const toc = require(path.join(__dirname, config.docPath, 'toc.js'));

    function _expandArray(array, pathPrefix: string): object {
        let result = {};

        for (let item of array) {
            if (item[0] === 'Home' || typeof item === 'string') continue;
            if (typeof item[1] === 'string') {
                result[item[0]] = pathPrefix + '/' + item[1];
            } else {
                let _pathPrefix = pathPrefix + '/' + item[1][0];
                result[item[0]] = Object.assign(_expandArray(item[1], _pathPrefix), { _dir : _pathPrefix });
            }
        }

        return result;
    }

    return _expandArray(toc[origin], '');
}

function showToc(tocOrigin, tocTarget, originLang, targetLang) {

    function _expandObject(object, layerNumber) {

        let result = [];

        for (let key in object) {
            if (!object.hasOwnProperty(key)) continue;
            if (key === 'Commands' && !config.showCommands) continue;
            if (key === '_dir') continue;
            if (typeof object[key] === 'string') {
                result.push([new Array(layerNumber + 1).join('  ') + '- ' + key, object[key]]);
            } else {
                result.push([new Array(layerNumber + 1).join('  ') + '- ' + key, object[key]._dir]);
                result.push(..._expandObject(object[key], layerNumber + 1));
            }
        }

        return result;
    }


    let _origin, _target, output;

    if (config.onlyShowCommands) {
        _origin = _expandObject({ Commands : tocOrigin['Commands'] }, 0);
        _target = _expandObject({ Commands : tocTarget['Commands'] !== undefined ? tocTarget['Commands'] : [] }, 0);
    } else {
        _origin = _expandObject(tocOrigin, 0);
        _target = _expandObject(tocTarget, 0);
    }

    let _targetObj = {};
    for (let x of _target) {
        _targetObj[x[1]] = x[0];
    }
    // _target.map((x) => _targetObj[x[1]] = x[0]);

    let data = [];
    for (let item of _origin) {
        let originName = item[0];
        let targetName = _targetObj[item[1]] !== undefined ? _targetObj[item[1]] : ' ';
        let docPath = item[1];
        let status = '';
        let originVersion = ' ';
        let targetVersion = ' ';

        if (!fs.existsSync(path.join(__dirname, config.docPath, originLang + docPath))) {
            status = 'OHangUp \x1b[91m◉\x1b[39m';
        } else if (fs.statSync(path.join(__dirname, config.docPath, originLang + docPath)).isDirectory()) {
            status = ' ';
        } else if (_targetObj[item[1]] === undefined) {
            status = 'Unlink  \x1b[91m◉\x1b[39m';
        } else {
            originVersion = getFileLastCommit(originLang + docPath);
            if (!fs.existsSync(path.join(__dirname, config.docPath, targetLang + docPath))) {
                status = 'HangUp  \x1b[91m◉\x1b[39m';
            } else if (originVersion === (targetVersion = getDocLastVersion(targetLang + docPath))) {
                status = 'Done    \x1b[92m✔\x1b[39m';
            } else {
                status = 'Expired \x1b[93m⬆\x1b[39m';
            }
        }

        if (!config.longHash) {
            originVersion = originVersion.substr(0, 8);
            targetVersion = targetVersion.substr(0, 8);
        }

        data.push([originName, targetName, status, originVersion, targetVersion, docPath]);
    }

    output = table(data, { singleLine : true });
    console.log(output);
    console.log('You can use ` appium-doc -a` to shows that all the documents. But we recommended to use `appium-doc' + ' commands` view the \'doc-commands\' section.\n');
}

program
    .version('0.0.0')
    .option('-L, --long-hash', 'Displays the full commit hash.')
    .option('-a, --show-commands', 'Displays the full document.')
    .option('-c, --only-show-commands', 'Display only the commands document.')
    .option('-t, --target-lang [lang]', `The language to be translated. default's cn`)
    .parse(process.argv);

if (program.longHash) config.longHash = true;
if (program.showCommands) config.showCommands = true;
if (typeof program.targetLang === 'string') config.targetLang = program.targetLang;
if (program.onlyShowCommands) {
    config.onlyShowCommands = true;
    config.showCommands = true;
}

main();
