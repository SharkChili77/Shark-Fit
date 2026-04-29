/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FinFit - 图片压缩工具 (imageUtils.js)
 *
 * 使用 browser-image-compression 在客户端压缩图片后再上传，
 * 大幅节约服务器带宽和磁盘空间。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import imageCompression from 'browser-image-compression';

/**
 * 压缩图片文件
 * @param {File} file - 原始图片文件
 * @param {object} options - 压缩选项
 * @param {number} options.maxSizeMB - 最大文件大小 (MB)，默认 0.1（100KB）
 * @param {number} options.maxWidthOrHeight - 最大宽高像素，默认 512
 * @returns {Promise<File>} 压缩后的 File 对象
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxSizeMB = 0.1,
    maxWidthOrHeight = 512,
  } = options;

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: 'image/jpeg', // 统一输出 JPEG，压缩率更高
    });

    console.log(
      `[图片压缩] ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB ` +
      `(压缩率 ${((1 - compressedFile.size / file.size) * 100).toFixed(0)}%)`
    );

    return compressedFile;
  } catch (err) {
    console.warn('[图片压缩] 压缩失败，使用原始文件:', err.message);
    return file; // 压缩失败时回退到原始文件
  }
};
