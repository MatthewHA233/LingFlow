import {
  BinaryProtocolHeader,
  MessageType,
  SerializationMethod,
  CompressionMethod
} from '@/types/tts';

/**
 * WebSocket 二进制协议处理器
 */
export class BinaryProtocol {
  
  /**
   * 创建协议头部
   */
  static createHeader(
    messageType: MessageType = MessageType.FULL_CLIENT_REQUEST,
    serializationMethod: SerializationMethod = SerializationMethod.JSON,
    compressionMethod: CompressionMethod = CompressionMethod.NONE
  ): BinaryProtocolHeader {
    return {
      protocolVersion: 0b0001, // 版本 1
      headerSize: 0b0001, // 4 字节
      messageType,
      messageTypeSpecificFlags: 0b0000,
      serializationMethod,
      compressionMethod,
      reserved: 0x00
    };
  }

  /**
   * 将头部编码为二进制数据
   */
  static encodeHeader(header: BinaryProtocolHeader): ArrayBuffer {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    
    // 将所有字段打包到一个 32 位整数中（大端序）
    let packed = 0;
    
    // 各字段位移
    packed |= (header.protocolVersion & 0xF) << 28;
    packed |= (header.headerSize & 0xF) << 24;
    packed |= (header.messageType & 0xF) << 20;
    packed |= (header.messageTypeSpecificFlags & 0xF) << 16;
    packed |= (header.serializationMethod & 0xF) << 12;
    packed |= (header.compressionMethod & 0xF) << 8;
    packed |= (header.reserved & 0xFF);
    
    view.setUint32(0, packed, false); // false = 大端序
    
    return buffer;
  }

  /**
   * 解码头部
   */
  static decodeHeader(buffer: ArrayBuffer): BinaryProtocolHeader {
    const view = new DataView(buffer);
    const packed = view.getUint32(0, false); // false = 大端序
    
    return {
      protocolVersion: (packed >>> 28) & 0xF,
      headerSize: (packed >>> 24) & 0xF,
      messageType: (packed >>> 20) & 0xF,
      messageTypeSpecificFlags: (packed >>> 16) & 0xF,
      serializationMethod: (packed >>> 12) & 0xF,
      compressionMethod: (packed >>> 8) & 0xF,
      reserved: packed & 0xFF
    };
  }

  /**
   * 创建完整的客户端请求消息
   */
  static createClientRequestMessage(jsonPayload: string, useGzip = false): ArrayBuffer {
    const header = this.createHeader(
      MessageType.FULL_CLIENT_REQUEST,
      SerializationMethod.JSON,
      useGzip ? CompressionMethod.GZIP : CompressionMethod.NONE
    );

    // 编码和压缩 payload
    let payloadBuffer: ArrayBuffer;
    if (useGzip) {
      // 注意：在浏览器环境中，需要使用 CompressionStream 或第三方库
      // 这里先实现未压缩版本
      const encoder = new TextEncoder();
      payloadBuffer = encoder.encode(jsonPayload).buffer;
    } else {
      const encoder = new TextEncoder();
      payloadBuffer = encoder.encode(jsonPayload).buffer;
    }

    // 创建完整消息
    const headerBuffer = this.encodeHeader(header);
    const payloadSizeBuffer = new ArrayBuffer(4);
    const payloadSizeView = new DataView(payloadSizeBuffer);
    payloadSizeView.setUint32(0, payloadBuffer.byteLength, false); // 大端序

    // 合并所有部分
    const totalLength = headerBuffer.byteLength + payloadSizeBuffer.byteLength + payloadBuffer.byteLength;
    const result = new ArrayBuffer(totalLength);
    const resultView = new Uint8Array(result);
    
    let offset = 0;
    resultView.set(new Uint8Array(headerBuffer), offset);
    offset += headerBuffer.byteLength;
    
    resultView.set(new Uint8Array(payloadSizeBuffer), offset);
    offset += payloadSizeBuffer.byteLength;
    
    resultView.set(new Uint8Array(payloadBuffer), offset);

    return result;
  }

  /**
   * 解析服务器响应
   */
  static parseServerResponse(buffer: ArrayBuffer): {
    header: BinaryProtocolHeader;
    audioData?: ArrayBuffer;
    sequence?: number;
  } {
    if (buffer.byteLength < 4) {
      throw new Error('Buffer too small for header');
    }

    const header = this.decodeHeader(buffer.slice(0, 4));
    
    if (header.messageType === MessageType.AUDIO_ONLY_SERVER_RESPONSE) {
      // 音频响应，提取序列号和音频数据
      const sequence = this.extractSequenceNumber(header.messageTypeSpecificFlags);
      const audioData = buffer.slice(4); // 头部后面就是音频数据
      
      return {
        header,
        audioData,
        sequence
      };
    } else if (header.messageType === MessageType.ERROR_MESSAGE) {
      // 错误消息，需要解析 JSON
      const payloadSizeView = new DataView(buffer, 4, 4);
      const payloadSize = payloadSizeView.getUint32(0, false);
      const jsonPayload = buffer.slice(8, 8 + payloadSize);
      const decoder = new TextDecoder();
      const errorMessage = decoder.decode(jsonPayload);
      
      throw new Error(`Server error: ${errorMessage}`);
    }

    return { header };
  }

  /**
   * 从 flags 中提取序列号
   */
  private static extractSequenceNumber(flags: number): number {
    // 根据文档，flags 的值决定序列号
    switch (flags) {
      case 0b0000: return 0; // 没有序列号
      case 0b0001: return 1; // 序列号 > 0
      case 0b0010:
      case 0b0011: return -1; // 序列号 < 0，表示最后一条消息
      default: return 0;
    }
  }

  /**
   * 检查是否为最后一条消息
   */
  static isLastMessage(flags: number): boolean {
    return flags === 0b0010 || flags === 0b0011;
  }
}