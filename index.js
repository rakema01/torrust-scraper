let config = {
    username: "",
    password: "",
    dlPath: `${process.cwd()}\\torrents`,
    maxSize: 20, // In GB
    pageSize: 100,
    concurrentDownloads: 10,
    hostname: "",
    port: 443
}

const Torrust = require("torrust-js");
const fs = require("fs");
const downloadTracker = `./downloaded.json`
const configFile = `./config.json`;
let exists = [];
const sizeSuffixes = ["B","KB","MB","GB","TB"];

if(!fs.existsSync(downloadTracker)){
    fs.writeFileSync(downloadTracker, JSON.stringify([]));
}else{
    exists = JSON.parse(fs.readFileSync(downloadTracker, {encoding: "utf-8"}));
}
// Needs better handling for missing config items
if(!fs.existsSync(configFile)){
    fs.writeFileSync(configFile, JSON.stringify(config, null, "\t"));
    console.error(`[INFO] Please fill in the information needed in config.json!`);
    process.exit(0);
}else{
    const savedConfig = JSON.parse(fs.readFileSync(configFile, {encoding: "utf-8"}));
    for(c in savedConfig){
        if(config[c] === undefined){
            console.log(`[WARN] Config ${c} does not match config list. Ignoring.`);
            continue;
        }
        config[c] = savedConfig[c];
    }
}

const torrust = new Torrust(config.username, config.password, config.hostname, config.port);

torrust.login()
    .then(async () => {
        const torrents = await torrust.getTorrents(config.pageSize);
        let results = torrents.results;
        let total = 0;
        const downloading = [];
        // Needs a better way to queue up downloads
        while(results.length > 0){
            if(downloading.length < config.concurrentDownloads){
                const torrent = results.pop();
                const {torrent_id, title, file_size} = torrent;
                const sizeSuffixIndex = Math.floor(Math.log10(file_size) / 3);
                if(exists.find(v => v == torrent.torrent_id)){
                    continue;
                }
                console.log(`[INFO] (${torrent_id}) ${title}: ${(file_size / Math.pow(1000,sizeSuffixIndex)).toFixed(2)}${sizeSuffixes[sizeSuffixIndex]}`)
                if(config.maxSize > -1 && file_size > config.maxSize * Math.pow(1000, 3)){
                    console.log("[INFO] Files are too large! Skipping...");
                    continue;
                }
                downloading.push(torrent.torrent_id);

                torrust.downloadTorrentFile(torrent_id, `./torrents`)
                    .then(() => {
                        downloading.splice(downloading.findIndex(v => v === torrent_id));
                        exists.push(torrent_id);
                        total++;
                        if(downloading.length === 0 && results.length === 0){
                            fs.writeFile(downloadTracker, JSON.stringify(exists), (err) => {
                                if(err) throw new Error(err);
                                console.log(`[INFO] Scrape finished. Downloaded a total of ${total} torrents`);
                                process.exit();
                            })
                        }
                    }, err => {
                        console.log(`[ERROR] ${torrent.torrent_id} failed to download due to: ${err}`);
                        downloading.splice(downloading.findIndex(v => v === torrent.torrent_id));
                    });
            }else{
                await new Promise(resolve => {setTimeout(resolve, 100)})
            }
        }
    }, err => {
        console.log(`[ERROR] Failed to login due to: ${err}`)
    })