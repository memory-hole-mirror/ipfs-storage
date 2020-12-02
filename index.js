const AWS_SDK = require('aws-sdk');
const UUID = require('node-uuid');
const S3_remote_url = "http://minio:9000"
const S3 = new AWS_SDK.S3({
    endpoint: S3_remote_url,
    accessKeyId: 'root',
    secretAccessKey: 'super_secret_key'
});

console.log("Running")
S3.listBuckets((err, data) => {
    if(err) throw new Error(err);
    console.log(data);
});

