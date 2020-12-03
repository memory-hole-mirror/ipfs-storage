const AWS_SDK = require('aws-sdk');
const UUID = require('node-uuid');
const fs = require('fs');
const IPFS = require('ipfs-core');
const util = require('util');
const path = require('path');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);
const mongoose = require('mongoose');

const fastify = require('fastify')({
    logger: false,
});
fastify.register(require('fastify-multipart'));


mongoose.connect('mongodb://mongo:27017/memoryhole', (err) => {
    if(err) throw new Error(err);
    console.info('Successfully connected to MongoDB');
});

const S3 = new AWS_SDK.S3({
    endpoint: 'http://172.20.0.2:9000',
    accessKeyId: 'root',
    secretAccessKey: 'super_secret_key',
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
});

const PostSchema = new mongoose.Schema({
    ID: String,
    time: {
        create: Date,
    },
    ipfs: {
        hash: {
            cid: mongoose.Mixed,
            cidString: String,
        },
        url: String,
    },
    s3: {
        fileName: String,
    }
});

const Posts = mongoose.model('Post', PostSchema);

fastify.get('/', async (req, res) => {
    try {
        const indexPageStream = fs.createReadStream('./index.html');
        res.type('text/html').send(indexPageStream);
    } catch (err) {
        console.error(err);
        res.send('Fail to send the index.html file');
    }
});

fastify.get('/posts', async (req, res) => {
    try {

        const posts = await Posts.find();

        return res.type('application/json').send(posts);
        
    } catch (err) {
        console.error(err);
        return res.status(500).type('application/json').send(
            JSON.stringify(
                {
                    error: 'internal error, /post route'
                }
            )
        );
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
            s3: {
                name: fields.file.filename,
            },
        };

        try {
            const newPost = new Posts({
                ID,
                time: {
                    create: new Date(),
                },
                ipfs: {
                    hash: {
                        cid,
                        cidString: cid.toString(),
                    },
                    url: `https://ipfs.io/ipfs/${cid.toString()}`,
                },
                s3: {
                    fileName: newFileName,
                }
            });
            await newPost.save();
        } catch (err) {
            console.error(err);
            return res.status(500).type('application/json').send( JSON.stringify({error: 'Internal Error, saving post to our database'}) );
        }

        return res.status(201).type('application/json').send( JSON.stringify(output) );
    } catch (err) {
        console.error(err);
        return res.status(500).type('application/json').send( JSON.stringify({error: 'Internal error, /upload route'}));
    }
});


fastify.get('/s3/get', (req, res) => {
    const { file } = req.query;
    if(!file) {
        return res.status(400).type('application/json').send(JSON.stringify({error: 'Missing file param'}));
    }
    const params = {
        Bucket: 'memory-hole',
        Key: file,
        Expires: 300, // Expire in 5 minutes
    }
    S3.getSignedUrl('getObject', params, (err, data) => {
        if(err) {
            console.error(err);
            return res.status(500).type('application/json').send(JSON.stringify({error: 'Internal error, fail to obtain S3 file'}));
        }
        res.send(data)
    });
});

fastify.listen(8000, '0.0.0.0', (err, addr) => {
    console.log(`Memory Hole server is running: ${addr}`);
});
