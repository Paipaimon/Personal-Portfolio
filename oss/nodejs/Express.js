const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const app = express();
const upload = multer({ dest: 'uploads/' });

const cors = require('cors');
app.use(cors()); // 允许所有跨域请求

const client = new OSS({
  region: 'oss-cn-beijing',
  accessKeyId: 'LTAI5tPwLsbzSiMjQ1yD9vv9',
  accessKeySecret: 'jspNjDQLgG0adDOcM3TXBBFOlqqGAx',
  bucket: 'jackli16'
});

// 获取文件列表
app.get('/api/files', async (req, res) => {
  try {
    const result = await client.list();
    res.json(result.objects); // 返回JSON格式的文件列表
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' }); // 返回JSON格式的错误信息
  }
});

// 上传文件
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const result = await client.put(file.originalname, file.path);
    res.json({ url: result.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// 删除文件
app.delete('/api/files/:name', async (req, res) => {
  try {
    const fileName = req.params.name;
    await client.delete(fileName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(2000, () => {
  console.log('Server is running on port 2000');
});