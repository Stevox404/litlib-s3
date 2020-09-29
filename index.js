const AWSMock = require('mock-aws-s3');
AWSMock.config.basePath = '/tmp/buckets/' 
const aws = process.env.NODE_ENV === 'test' ?
    AWSMock : require('aws-sdk');
const fsPromises = require('fs').promises;
require('dotenv').config();

let initializedS3;

module.exports.S3 = S3;

/**
 * Constructor for s3 fs.
 * @param {S3Config} newConfig 
 */
function S3(newConfig) {
    /**@type {{awsS3: AWS.S3}} */
    let awsS3, config;
    if (newConfig) {
        ({ awsS3, config } = init(newConfig));
    } else {
        if (!initializedS3) {
            initializedS3 = init();
        }
        ({ awsS3, config } = initializedS3);
    }
    if (!awsS3 || !config) {
        throw new Error('S3 not initialized');
    }

    /**
     * @type {string} Base url to s3 bucket
     */
    this.url = config.url

    /**
     * Get file in S3 Bucket 
     * @param {string} filepath - path to object in Bucket
     * @param {import('aws-sdk/clients/s3').GetObjectRequest} s3GetParams
     * @returns {Promise<import('aws-sdk/clients/s3').GetObjectOutput>} data
     */
    this.getFile = function (filepath, s3GetParams) {
        return new Promise((resolve, reject) => {
            // Check if fully qualified filepath
            const regex = RegExp(`^${config.url}/`);
            filepath = filepath.replace(regex, '');

            const params = {
                Bucket: config.bucket,
                Key: filepath,
                ...s3GetParams,
            };
            const MIME = getMIME(filepath);
            awsS3.getObject(params, (err, data) => {
                if (err) return reject(err);
                data.ContentType = MIME;
                resolve(data);
            });
        });
    }

    /**
     * Save file to S3
     * @param {string} filepath - path to save object in bucket
     * @param {{path: string}} file - File to be read. 
     *  Can pass "path" property for fs path or actual data.
     * @param {import('aws-sdk/clients/s3').PutObjectRequest} s3PutParams
     *  Defaults to public-read
     * @returns {Promise<string>} - File url
     */
    this.saveFile = function (filepath, file, s3PutParams) {
        return new Promise(async (resolve, reject) => {
            if (!filepath || !file) return null;
            const data = file.path ? await fsPromises.readFile(file.path) : file;
            filepath = String(filepath).replace(/^\//, '')
            const params = {
                Bucket: config.bucket,
                Key: filepath,
                Body: data,
                ACL: 'public-read',
                ContentDisposition: 'inline',
                ...s3PutParams,
            };

            const mime = getMIME(filepath);
            if (mime) params.ContentType = mime;
            
            awsS3.putObject(params, err => {
                if (err) return reject(err);
                resolve(`${config.url}/${filepath}`);
            });
        })
    }

    /**
     * Delete object in S3 bucket
     * @param {string} filepath - path to object in Bucket
     * @param {import('aws-sdk/clients/s3').DeleteObjectRequest} s3PutParams
     * @returns {Promise<import('aws-sdk/clients/s3').DeleteObjectOutput>}
     */
    this.deleteFile = function (filepath) {
        if (!filepath) return null;
        new Promise((resolve, reject) => {
            // Check if fully qualified filepath
            const regex = RegExp(`^${config.url}/`);
            filepath = filepath.replace(regex, '');

            const params = {
                Bucket: config.bucket,
                Key: filepath,
            };
            awsS3.deleteObject(params, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        })
    };

}
S3.init = function (newConfig) {
    initializedS3 = init(newConfig);
};
S3.reset = function () {
    initializedS3 = undefined;
};



/**
 * @param {S3Config} newConfig 
 */
function init(newConfig = {}) {
    const config = {
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'us-east-1',
        ...(newConfig.extendConfig && initializedEmail.config),
        ...newConfig,
    }
    delete config.extendConfig;
    
    if (!config.bucket) {
        throw new Error('Requires bucket for initialization');
    }
    config.url = `https://${config.bucket}.s3.amazonaws.com`;
    const awsS3 = new aws.S3();
    
    if(process.env.NODE_ENV !== 'test'){
        aws.config.update({ region: config.region });
    }
    return { awsS3, config };
}

function getMIME(filepath) {
    if (!/\.(\w+)$/.test(filepath)) {
        return null;
    }
    const ext = /\.(\w+)$/.exec(filepath)[1].toLowerCase();
    const mimes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',

        'txt': 'text/plain',
        'pdf': 'application/pdf',

        'mp3': 'audio/mpeg',
        'mp4': 'video/mpe4',

        'doc': 'application/msword',
        'dot': 'application/msword',

        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'docm': 'application/vnd.ms-word.document.macroEnabled.12',
        'dotm': 'application/vnd.ms-word.template.macroEnabled.12',

        'xls': 'application/vnd.ms-excel',
        'xlt': 'application/vnd.ms-excel',
        'xla': 'application/vnd.ms-excel',

        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        'xltm': 'application/vnd.ms-excel.template.macroEnabled.12',
        'xlam': 'application/vnd.ms-excel.addin.macroEnabled.12',
        'xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',

        'ppt': 'application/vnd.ms-powerpoint',
        'pot': 'application/vnd.ms-powerpoint',
        'pps': 'application/vnd.ms-powerpoint',
        'ppa': 'application/vnd.ms-powerpoint',

        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
        'ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
        'ppam': 'application/vnd.ms-powerpoint.addin.macroEnabled.12',
        'pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'potm': 'application/vnd.ms-powerpoint.template.macroEnabled.12',
        'ppsm': 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',

        'mdb': 'application/vnd.ms-access',
    }
    return mimes[ext];
}


/** @typedef {{
 *  bucket: string,
 *  region: string,
 * }} S3Config
 */
