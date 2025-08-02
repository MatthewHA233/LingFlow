import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllVoices, 
  getVoicesByCategory, 
  getVoiceCategories,
  validateVoiceConfiguration
} from '@/types/tts';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const validate = searchParams.get('validate') === 'true';
    
    if (validate) {
      // 验证音色配置
      const validation = validateVoiceConfiguration();
      return NextResponse.json(validation);
    }
    
    if (category) {
      // 返回特定分类的音色
      const voices = getVoicesByCategory(category);
      return NextResponse.json({
        success: true,
        category,
        count: voices.length,
        voices
      });
    }
    
    // 返回所有音色和分类信息
    const allVoices = getAllVoices();
    const categories = getVoiceCategories();
    
    // 统计信息
    const stats = {
      totalVoices: allVoices.length,
      totalCategories: categories.length,
      categoryCounts: categories.reduce((acc, cat) => {
        acc[cat] = getVoicesByCategory(cat).length;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return NextResponse.json({
      success: true,
      stats,
      categories,
      voices: allVoices
    });
    
  } catch (error) {
    console.error('获取音色列表失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '获取音色列表失败' 
      },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}