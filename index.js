const AWS_SDK = require('aws-sdk');
const UUID = require('node-uuid');
const S3_remote_url = 'http://172.18.0.2:9000'
const fs = require('fs');
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
        const data = await req.file();
        const fields = data.fields;

        const params = {
            Body: data.file,
            Bucket: 'memory-hole',
            Key: `${UUID.v4()}-${fields.file.filename}`,
        };
        res.send("Uploading your data");
        S3.upload(params, (err, data) => {
            if(err) throw new Error(err);
        });
    } catch (err) {
        console.error(err);
    }
});

fastify.listen(8000, (err, addr) => {
    console.log(`Memory Hole server is running: ${addr}`);
});
