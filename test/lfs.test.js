process.env.NODE_ENV = 'test';
const { S3 } = require("../index");
const path = require('path');
const { expect } = require("chai");

describe('lfs', () => {
    it('Should initialize a new S3 object', async () => {
        S3.reset();
        const s3 = new S3({ bucket: 'bkt', region: 'us-east-2' });
        expect(s3.url).to.match(/bkt/);
    });

    it('Should auto initialize if possible', async () => {
        process.env.S3_BUCKET = 'auto-bkt';
        process.env.S3_REGION = 'us-east-1';
        S3.reset();
        const s3 = new S3();
        expect(s3.url).to.match(/auto-bkt/);
    });

    it('Should throw initialization error if no bucket or region', async () => {
        let error;
        process.env.S3_BUCKET = '';
        S3.reset();
        try {
            new S3({});
        } catch (err) {
            error = err;
        }
        expect(error.message).to.equal('Requires region and bucket for initialization');
    });

    it('Saves file', async () => {
        process.env.S3_BUCKET = 'auto-bkt';
        process.env.S3_REGION = 'us-east-1';
        const s3 = new S3();
        expect(s3.url).to.not.be.null;
        await s3.saveFile('/test.txt', { path: path.resolve(__dirname, 'sample-file.txt') });
        const data = await s3.getFile('/test.txt');
        expect(data.Body).to.not.be.null;
        await s3.deleteFile('/test.txt');
        try {
            await s3.getFile('/test.txt');
        } catch (err) {
            expect(err.code).to.equal('NoSuchKey');
        }
    });

})