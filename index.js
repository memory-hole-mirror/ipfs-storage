const AWS_SDK = require('aws-sdk');
const UUID = require('node-uuid');
const S3_remote_url = 'http://minio:9000'
const fs = require('fs');
const IPFS = require('ipfs-core');
const util = require('util');
const path = require('path');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);

const fastify = require('fastify')({
    logger: false,
});
fastify.register(require('fastify-multipart'));

const S3 = new AWS_SDK.S3({
    endpoint: S3_remote_url,
    accessKeyId: 'root',
    secretAccessKey: 'super_secret_key',
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
});

fastify.get('/', async (req, res) => {
    try {
        const indexPageStream = fs.createReadStream('./index.html');
        res.type('text/html').send(indexPageStream);
    } catch (err) {
        console.error(err);
        res.send('Fail to send the index.html file');
    }
});

fastify.post('/upload', async (req, res) => {
    try {
        // Uploading the file to a S3 storage
        const data = await req.file();
        const fields = data.fields;
        const ID = UUID.v4();
        const newFileName = `${ID}-${fields.file.filename}`;
        const params = {
            Body: data.file,
            Bucket: 'memory-hole',
            Key: newFileName,
        };
        S3.upload(params, (err, data) => {
            if(err) throw new Error(err);
        });

        // Uploading file to the IPFS network 
        await pump(data.file, fs.createWriteStream(`/tmp/${newFileName}`));
        const ipfs = await IPFS.create();
        const { cid } = await ipfs.add( fs.createReadStream(`/tmp/${newFileName}`) );
        const output = {
            ID, 
            file_name: newFileName,
            ipfs: {
                hash: {
                cid,
                cid_string: cid.toString(),
            },
                url: `https://ipfs.io/ipfs/${cid}`
            },
            file: {
                name: fields.file.filename,
                type: fields.file.mimetype
            },
        };
        return res.status(201).type('application/json').send( JSON.stringify(output) );
    } catch (err) {
        console.error(err);
        return res.status(500).send('Internal Error');
    }
});

fastify.listen(8000, '0.0.0.0', (err, addr) => {
    console.log(`Memory Hole server is running: ${addr}`);
});
