// 豆包 TTS 相关类型定义 - 大模型语音合成API

// TTS 请求参数
export interface TTSRequest {
  app: {
    appid: string;
    token: string;
    cluster: string;
  };
  user: {
    uid: string;
  };
  audio: {
    voice_type: string;
    encoding: string;
    speed_ratio?: number;
    emotion?: string;
    enable_emotion?: boolean;
    emotion_scale?: number;
    rate?: number;
    bitrate?: number;
    explicit_language?: string;
    context_language?: string;
    loudness_ratio?: number;
  };
  request: {
    reqid: string;
    text: string;
    operation: string;
    text_type?: string;
    silence_duration?: number;
    with_timestamp?: number | string;
    extra_param?: string;
  };
}

// TTS 响应格式
export interface TTSResponse {
  reqid: string;
  code: number;
  operation: string;
  message: string;
  sequence: number;
  data: string; // Base64 编码的音频数据
  addition: {
    duration: string; // 音频时长（毫秒）
  };
}

// 支持的音色类型 - 大模型音色
export enum VoiceType {
  // 多情感音色
  ZH_MALE_BEIJINGXIAOYE_EMO = 'zh_male_beijingxiaoye_emo_v2_mars_bigtts', // 北京小爷（多情感）
  ZH_FEMALE_ROUMEINVYOU_EMO = 'zh_female_roumeinvyou_emo_v2_mars_bigtts', // 柔美女友（多情感）
  ZH_MALE_YANGGUANGQINGNIAN_EMO = 'zh_male_yangguangqingnian_emo_v2_mars_bigtts', // 阳光青年（多情感）
  ZH_FEMALE_MEILINVYOU_EMO = 'zh_female_meilinvyou_emo_v2_mars_bigtts', // 魅力女友（多情感）
  ZH_FEMALE_SHUANGKUAISISI_EMO = 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', // 爽快思思（多情感）
  ZH_FEMALE_TIANXINXIAOMEI_EMO = 'zh_female_tianxinxiaomei_emo_v2_mars_bigtts', // 甜心小美（多情感）
  ZH_FEMALE_GAOLENGYUJIE_EMO = 'zh_female_gaolengyujie_emo_v2_mars_bigtts', // 高冷御姐（多情感）
  ZH_MALE_AOJIAOBAZONG_EMO = 'zh_male_aojiaobazong_emo_v2_mars_bigtts', // 傲娇霸总（多情感）
  ZH_MALE_GUANGZHOUDEGE_EMO = 'zh_male_guangzhoudege_emo_mars_bigtts', // 广州德哥（多情感）
  ZH_MALE_JINGQIANGKANYE_EMO = 'zh_male_jingqiangkanye_emo_mars_bigtts', // 京腔侃爷（多情感）
  ZH_FEMALE_LINJUAYI_EMO = 'zh_female_linjuayi_emo_v2_mars_bigtts', // 邻居阿姨（多情感）
  ZH_MALE_YOUROUGONGZI_EMO = 'zh_male_yourougongzi_emo_v2_mars_bigtts', // 优柔公子（多情感）
  ZH_MALE_RUYAYICHEN_EMO = 'zh_male_ruyayichen_emo_v2_mars_bigtts', // 儒雅男友（多情感）
  ZH_MALE_JUNLANGNANYOU_EMO = 'zh_male_junlangnanyou_emo_v2_mars_bigtts', // 俊朗男友（多情感）
  ZH_MALE_LENGKUGEGE_EMO = 'zh_male_lengkugege_emo_v2_mars_bigtts', // 冷酷哥哥（多情感）

  // 英文多情感音色
  EN_MALE_GLEN_EMO = 'en_male_glen_emo_v2_mars_bigtts', // Glen
  EN_MALE_SYLUS_EMO = 'en_male_sylus_emo_v2_mars_bigtts', // Sylus
  EN_FEMALE_CANDICE_EMO = 'en_female_candice_emo_v2_mars_bigtts', // Candice
  EN_MALE_COREY_EMO = 'en_male_corey_emo_v2_mars_bigtts', // Corey
  EN_FEMALE_NADIA_EMO = 'en_female_nadia_tips_emo_v2_mars_bigtts', // Nadia
  EN_FEMALE_SERENA_EMO = 'en_female_skye_emo_v2_mars_bigtts', // Serena

  // 教育场景
  ZH_FEMALE_TINA_TEACHER = 'zh_female_yingyujiaoyu_mars_bigtts', // Tina老师

  // 客服场景
  ZH_FEMALE_KEFU = 'zh_female_kefunvsheng_mars_bigtts', // 暖阳女声

  // 通用场景
  ZH_FEMALE_TIANMEITAOZI = 'zh_female_tianmeitaozi_mars_bigtts', // 甜美桃子
  ZH_FEMALE_VIVI = 'zh_female_vv_mars_bigtts', // Vivi
  ZH_FEMALE_CANCAN = 'zh_female_cancan_mars_bigtts', // 灿灿/Shiny
  ZH_FEMALE_QINGXINNVSHENG = 'zh_female_qingxinnvsheng_mars_bigtts', // 清新女声
  ZH_FEMALE_SHUANGKUAISISI = 'zh_female_shuangkuaisisi_moon_bigtts', // 爽快思思/Skye
  ZH_MALE_WENNUANAHU = 'zh_male_wennuanahu_moon_bigtts', // 温暖阿虎/Alvin
  ZH_MALE_SHAONIANZIXIN = 'zh_male_shaonianzixin_moon_bigtts', // 少年梓辛/Brayan
  ZH_FEMALE_ZHIXINGNVSHENG = 'zh_female_zhixingnvsheng_mars_bigtts', // 知性女声
  ZH_MALE_QINGSHUANGNANDA = 'zh_male_qingshuangnanda_mars_bigtts', // 清爽男大
  ZH_FEMALE_LINJIANVHAI = 'zh_female_linjianvhai_moon_bigtts', // 邻家女孩
  ZH_MALE_YUANBOXIAOSHU = 'zh_male_yuanboxiaoshu_moon_bigtts', // 渊博小叔
  ZH_MALE_YANGGUANGQINGNIAN = 'zh_male_yangguangqingnian_moon_bigtts', // 阳光青年
  ZH_FEMALE_TIANMEIXIAOYUAN = 'zh_female_tianmeixiaoyuan_moon_bigtts', // 甜美小源
  ZH_FEMALE_QINGCHEZIZI = 'zh_female_qingchezizi_moon_bigtts', // 清澈梓梓
  ZH_MALE_JIESHUOXIAOMING = 'zh_male_jieshuoxiaoming_moon_bigtts', // 解说小明
  ZH_FEMALE_KAILANGJIEJIE = 'zh_female_kailangjiejie_moon_bigtts', // 开朗姐姐
  ZH_MALE_LINJIANANHAI = 'zh_male_linjiananhai_moon_bigtts', // 邻家男孩
  ZH_FEMALE_TIANMEIYUEYUE = 'zh_female_tianmeiyueyue_moon_bigtts', // 甜美悦悦
  ZH_FEMALE_XINLINGJITANG = 'zh_female_xinlingjitang_moon_bigtts', // 心灵鸡汤
  ICL_ZH_FEMALE_ZHIXINGWENWAN = 'ICL_zh_female_zhixingwenwan_tob', // 知性温婉
  ICL_ZH_MALE_NUANXINTITIE = 'ICL_zh_male_nuanxintitie_tob', // 暖心体贴
  ICL_ZH_FEMALE_WENROUWENYA = 'ICL_zh_female_wenrouwenya_tob', // 温柔文雅
  ICL_ZH_MALE_KAILANGQINGKUAI = 'ICL_zh_male_kailangqingkuai_tob', // 开朗轻快
  ICL_ZH_MALE_HUOPOSHUANGLANG = 'ICL_zh_male_huoposhuanglang_tob', // 活泼爽朗  
  ICL_ZH_MALE_SHUAIZHENXIAOHUO = 'ICL_zh_male_shuaizhenxiaohuo_tob', // 率真小伙
  ZH_MALE_WENROUXIAOGE = 'zh_male_wenrouxiaoge_mars_bigtts', // 温柔小哥
  ZH_FEMALE_QINQIENVSHENG = 'zh_female_qinqienvsheng_moon_bigtts', // 亲切女声
  ICL_ZH_MALE_SHENMI = 'ICL_zh_male_shenmi_v1_tob', // 机灵小伙
  ICL_ZH_FEMALE_WUXI = 'ICL_zh_female_wuxi_tob', // 元气甜妹
  ICL_ZH_FEMALE_WENYINVSHENG = 'ICL_zh_female_wenyinvsheng_v1_tob', // 知心姐姐
  ZH_MALE_QINGYIYUXUAN = 'zh_male_qingyiyuxuan_mars_bigtts', // 阳光阿辰
  ZH_MALE_XUDONG = 'zh_male_xudong_conversation_wvae_bigtts', // 快乐小东
  ICL_ZH_MALE_LENGKUGEGE = 'ICL_zh_male_lengkugege_v1_tob', // 冷酷哥哥
  ICL_ZH_FEMALE_FEICUI = 'ICL_zh_female_feicui_v1_tob', // 纯澈女生
  ICL_ZH_FEMALE_YUXIN = 'ICL_zh_female_yuxin_v1_tob', // 初恋女友
  ICL_ZH_FEMALE_XNX = 'ICL_zh_female_xnx_tob', // 贴心闺蜜
  ICL_ZH_FEMALE_YRY = 'ICL_zh_female_yry_tob', // 温柔白月光
  EN_MALE_JASON = 'en_male_jason_conversation_wvae_bigtts', // 开朗学长
  ZH_FEMALE_SOPHIE = 'zh_female_sophie_conversation_wvae_bigtts', // 魅力苏菲
  ICL_ZH_FEMALE_YILIN = 'ICL_zh_female_yilin_tob', // 贴心妹妹

  // 多语种音色
  EN_MALE_SMITH = 'en_male_smith_mars_bigtts', // Smith（英式英语）
  EN_FEMALE_ANNA = 'en_female_anna_mars_bigtts', // Anna（英式英语）
  EN_MALE_ADAM = 'en_male_adam_mars_bigtts', // Adam（美式英语）
  EN_FEMALE_SARAH = 'en_female_sarah_mars_bigtts', // Sarah（澳洲英语）
  EN_MALE_DRYW = 'en_male_dryw_mars_bigtts', // Dryw（澳洲英语）
  EN_FEMALE_AMANDA = 'en_female_amanda_mars_bigtts', // Amanda（美式英语）
  EN_MALE_JACKSON = 'en_male_jackson_mars_bigtts', // Jackson（美式英语）
  ICL_EN_MALE_CC_SHA = 'ICL_en_male_cc_sha_v1_tob', // Cartoon Chef
  EN_FEMALE_EMILY = 'en_female_emily_mars_bigtts', // Emily（英式英语）
  EN_MALE_DANIEL = 'en_male_daniel_mars_bigtts', // Daniel（英式英语）
  EN_MALE_LUCAS = 'zh_male_M100_conversation_wvae_bigtts', // Lucas（美式英语）
  EN_FEMALE_SOPHIE = 'en_female_sophie_mars_bigtts', // Sophie（美式英语）
  EN_FEMALE_DAISY = 'en_female_dacey_conversation_wvae_bigtts', // Daisy（美式英语）
  EN_MALE_OWEN = 'en_male_charlie_conversation_wvae_bigtts', // Owen（美式英语）
  ICL_EN_MALE_AUSSIE = 'ICL_en_male_aussie_v1_tob', // Ethan（澳洲英语）
  EN_FEMALE_LUNA = 'en_female_sarah_new_conversation_wvae_bigtts', // Luna（美式英语）
  ICL_EN_MALE_MICHAEL = 'ICL_en_male_michael_tob', // Michael（美式英语）
  ICL_EN_MALE_ALASTOR = 'ICL_en_male_cc_alastor_tob', // Alastor（英式英语）
  ICL_EN_FEMALE_CHARLIE = 'ICL_en_female_cc_cm_v1_tob', // Charlie（美式英语）
  ICL_EN_MALE_BIG_BOOGIE = 'ICL_en_male_oogie2_tob', // Big Boogie（美式英语）
  ICL_EN_MALE_FROSTY_MAN = 'ICL_en_male_frosty1_tob', // Frosty Man（美式英语）
  ICL_EN_MALE_GRINCH = 'ICL_en_male_grinch2_tob', // The Grinch（美式英语）
  ICL_EN_MALE_ZAYNE = 'ICL_en_male_zayne_tob', // Zayne（美式英语）
  ICL_EN_MALE_JIGSAW = 'ICL_en_male_cc_jigsaw_tob', // Jigsaw（美式英语）
  ICL_EN_MALE_CHUCKY = 'ICL_en_male_cc_chucky_tob', // Chucky（美式英语）
  ICL_EN_MALE_CLOWN_MAN = 'ICL_en_male_cc_penny_v1_tob', // Clown Man（美式英语）
  ICL_EN_MALE_KEVIN = 'ICL_en_male_kevin2_tob', // Kevin McCallister（美式英语）
  ICL_EN_MALE_XAVIER = 'ICL_en_male_xavier1_v1_tob', // Xavier（美式英语）
  ICL_EN_MALE_NOAH = 'ICL_en_male_cc_dracula_v1_tob', // Noah（美式英语）
  EN_MALE_ENERGETIC_II = 'en_male_campaign_jamal_moon_bigtts', // Energetic Male II（美式英语）
  EN_MALE_GOTHAM_HERO = 'en_male_chris_moon_bigtts', // Gotham Hero（美式英语）
  EN_FEMALE_DELICATE_GIRL = 'en_female_daisy_moon_bigtts', // Delicate Girl（英式英语）
  EN_FEMALE_FLIRTY = 'en_female_product_darcie_moon_bigtts', // Flirty Female（美式英语）
  EN_FEMALE_PEACEFUL = 'en_female_emotional_moon_bigtts', // Peaceful Female（美式英语）
  EN_FEMALE_NARA = 'en_female_nara_moon_bigtts', // Nara（美式英语）
  EN_MALE_BRUCE = 'en_male_bruce_moon_bigtts', // Bruce（美式英语）
  EN_MALE_DAVE = 'en_male_dave_moon_bigtts', // Dave（英式英语）
  EN_MALE_MICHAEL_MOON = 'en_male_michael_moon_bigtts', // Michael（美式英语）
  EN_MALE_HADES = 'en_male_hades_moon_bigtts', // Hades（英式英语）
  EN_FEMALE_ONEZ = 'en_female_onez_moon_bigtts', // Onez（英式英语）
  EN_FEMALE_NADIA_POETRY = 'en_female_nadia_poetry_emo_v2_mars_bigtts', // Nadia Poetry（美式英语）

  // 日语西语多语种
  MULTI_MALE_JAVIER = 'multi_male_jingqiangkanye_moon_bigtts', // かずね（和音）/Javier or Álvaro
  MULTI_FEMALE_ESMERALDA = 'multi_female_shuangkuaisisi_moon_bigtts', // はるこ（晴子）/Esmeralda
  MULTI_MALE_ROBERTO = 'multi_male_wanqudashu_moon_bigtts', // ひろし（広志）/Roberto
  MULTI_FEMALE_AKEMI = 'multi_female_gaolengyujie_moon_bigtts', // あけみ（朱美）
  MULTI_MALE_HIKARU = 'multi_zh_male_youyoujunzi_moon_bigtts', // ひかる（光）
  MULTI_FEMALE_DIANA = 'multi_female_maomao_conversation_wvae_bigtts', // Diana（西语）
  MULTI_MALE_LUCIA = 'multi_male_M100_conversation_wvae_bigtts', // Lucía（西语）
  MULTI_FEMALE_SOFIA = 'multi_female_sophie_conversation_wvae_bigtts', // Sofía（西语）
  MULTI_MALE_DANIEL = 'multi_male_xudong_conversation_wvae_bigtts', // Daníel（西语）
  MULTI_FEMALE_SATOMI = 'multi_female_sophie_conversation_wvae_bigtts', // さとみ（智美）（日语）
  MULTI_MALE_MASAO = 'multi_male_xudong_conversation_wvae_bigtts', // まさお（正男）（日语）
  MULTI_FEMALE_TSUKI = 'multi_female_tsuki_mars_bigtts', // つき（月）（日语）

  // 趣味口音
  ZH_MALE_JINGQIANGKANYE = 'zh_male_jingqiangkanye_moon_bigtts', // 京腔侃爷/Harmony
  ZH_FEMALE_WANWANXIAOHE = 'zh_female_wanwanxiaohe_moon_bigtts', // 湾湾小何（台湾口音）
  ZH_FEMALE_WANQUDASHU = 'zh_female_wanqudashu_moon_bigtts', // 湾区大叔（广东口音）
  ZH_FEMALE_DAIMENGCHUANMEI = 'zh_female_daimengchuanmei_moon_bigtts', // 呆萌川妹（四川口音）
  ZH_MALE_GUANGZHOUDEGE = 'zh_male_guozhoudege_moon_bigtts', // 广州德哥（广东口音）
  ZH_MALE_BEIJINGXIAOYE = 'zh_male_beijingxiaoye_moon_bigtts', // 北京小爷（北京口音）
  ZH_MALE_HAOYUXIAOGE = 'zh_male_haoyuxiaoge_moon_bigtts', // 浩宇小哥（青岛口音）
  ZH_MALE_GUANGXIYUANZHOU = 'zh_male_guangxiyuanzhou_moon_bigtts', // 广西远舟（广西口音）
  ZH_FEMALE_MEITUOJIEER = 'zh_female_meituojieer_moon_bigtts', // 妹坨洁儿（长沙口音）
  ZH_MALE_YUZHOUZIXUAN = 'zh_male_yuzhouzixuan_moon_bigtts', // 豫州子轩（河南口音）

  // 角色扮演
  ZH_MALE_NAIQIMENGWA = 'zh_male_naiqimengwa_mars_bigtts', // 奶气萌娃
  ZH_FEMALE_POPO = 'zh_female_popo_mars_bigtts', // 婆婆
  ZH_FEMALE_GAOLENGYUJIE = 'zh_female_gaolengyujie_moon_bigtts', // 高冷御姐
  ZH_MALE_AOJIAOBAZONG = 'zh_male_aojiaobazong_moon_bigtts', // 傲娇霸总
  ZH_FEMALE_MEILINVYOU = 'zh_female_meilinvyou_moon_bigtts', // 魅力女友
  ZH_MALE_SHENYEBOKE = 'zh_male_shenyeboke_moon_bigtts', // 深夜播客
  ZH_FEMALE_SAJIAONVYOU = 'zh_female_sajiaonvyou_moon_bigtts', // 柔美女友
  ZH_FEMALE_YUANQINVYOU = 'zh_female_yuanqinvyou_moon_bigtts', // 撒娇学妹
  ICL_ZH_FEMALE_BINGRUOSHAONV = 'ICL_zh_female_bingruoshaonv_tob', // 病弱少女
  ICL_ZH_FEMALE_HUOPONVHAI = 'ICL_zh_female_huoponvhai_tob', // 活泼女孩
  ZH_MALE_DONGFANGHAORAN = 'zh_male_dongfanghaoran_moon_bigtts', // 东方浩然
  // [继续添加大量角色扮演音色...]
  ICL_ZH_MALE_LVCHAXIAOGE = 'ICL_zh_male_lvchaxiaoge_tob', // 绿茶小哥
  ICL_ZH_FEMALE_JIAORUOLUOLI = 'ICL_zh_female_jiaoruoluoli_tob', // 娇弱萝莉
  ICL_ZH_MALE_LENGDANSHULI = 'ICL_zh_male_lengdanshuli_tob', // 冷淡疏离
  ICL_ZH_MALE_HANHOUDUNSHI = 'ICL_zh_male_hanhoudunshi_tob', // 憨厚敦实
  ICL_ZH_MALE_AIQILINGREN = 'ICL_zh_male_aiqilingren_tob', // 傲气凌人
  ICL_ZH_FEMALE_HUOPODIAOMAN = 'ICL_zh_female_huopodiaoman_tob', // 活泼刁蛮
  ICL_ZH_MALE_GUZHIBINGJIAO = 'ICL_zh_male_guzhibingjiao_tob', // 固执病娇
  ICL_ZH_MALE_SAJIAONIANREN = 'ICL_zh_male_sajiaonianren_tob', // 撒娇粘人
  ICL_ZH_FEMALE_AOMANJIAOSHENG = 'ICL_zh_female_aomanjiaosheng_tob', // 傲慢娇声
  ICL_ZH_MALE_XIAOSASUIXING = 'ICL_zh_male_xiaosasuixing_tob', // 潇洒随性
  ICL_ZH_MALE_FUHEIGONGZI = 'ICL_zh_male_fuheigongzi_tob', // 腹黑公子
  ICL_ZH_MALE_GUIYISHENMI = 'ICL_zh_male_guiyishenmi_tob', // 诡异神秘
  ICL_ZH_MALE_RUYACAIJUN = 'ICL_zh_male_ruyacaijun_tob', // 儒雅才俊
  ICL_ZH_MALE_BINGJIAOBAILIAN = 'ICL_zh_male_bingjiaobailian_tob', // 病娇白莲
  ICL_ZH_MALE_ZHENGZHIQINGNIAN = 'ICL_zh_male_zhengzhiqingnian_tob', // 正直青年
  ICL_ZH_FEMALE_JIAOHANNVWANG = 'ICL_zh_female_jiaohannvwang_tob', // 娇憨女王
  ICL_ZH_FEMALE_BINGJIAOMENGMEI = 'ICL_zh_female_bingjiaomengmei_tob', // 病娇萌妹
  ICL_ZH_MALE_QINGSENAIGOU = 'ICL_zh_male_qingsenaigou_tob', // 青涩小生
  ICL_ZH_MALE_CHUNZHENXUEDI = 'ICL_zh_male_chunzhenxuedi_tob', // 纯真学弟
  ICL_ZH_FEMALE_NUANXINXUEJIE = 'ICL_zh_female_nuanxinxuejie_tob', // 暖心学姐
  ICL_ZH_FEMALE_KEAINVSHENG = 'ICL_zh_female_keainvsheng_tob', // 可爱女生
  ICL_ZH_FEMALE_CHENGSHUJIEJIE = 'ICL_zh_female_chengshujiejie_tob', // 成熟姐姐
  ICL_ZH_FEMALE_BINGJIAOJIEJIE = 'ICL_zh_female_bingjiaojiejie_tob', // 病娇姐姐
  ICL_ZH_MALE_YOUROUBANGZHU = 'ICL_zh_male_youroubangzhu_tob', // 优柔帮主
  ICL_ZH_MALE_YOUROUGONGZI = 'ICL_zh_male_yourougongzi_tob', // 优柔公子
  ICL_ZH_FEMALE_WUMEIYUJIE = 'ICL_zh_female_wumeiyujie_tob', // 妩媚御姐
  ICL_ZH_FEMALE_TIAOPIGONGZHU = 'ICL_zh_female_tiaopigongzhu_tob', // 调皮公主
  ICL_ZH_FEMALE_AOJIAONVYOU = 'ICL_zh_female_aojiaonvyou_tob', // 傲娇女友
  ICL_ZH_MALE_TIEXINNANYOU = 'ICL_zh_male_tiexinnanyou_tob', // 贴心男友
  ICL_ZH_MALE_SHAONIANJIANGJUN = 'ICL_zh_male_shaonianjiangjun_tob', // 少年将军
  ICL_ZH_FEMALE_TIEXINNVYOU = 'ICL_zh_female_tiexinnvyou_tob', // 贴心女友
  ICL_ZH_MALE_BINGJIAOGEGE = 'ICL_zh_male_bingjiaogege_tob', // 病娇哥哥
  ICL_ZH_MALE_XUEBANANTONGZHUO = 'ICL_zh_male_xuebanantongzhuo_tob', // 学霸男同桌
  ICL_ZH_MALE_YOUMOSHUSHU = 'ICL_zh_male_youmoshushu_tob', // 幽默叔叔
  ICL_ZH_FEMALE_GANLI = 'ICL_zh_female_ganli_v1_tob', // 妩媚可人
  ICL_ZH_FEMALE_XIANGLIANGYA = 'ICL_zh_female_xiangliangya_v1_tob', // 邪魅御姐
  ICL_ZH_FEMALE_XINGGANYUJIE = 'ICL_zh_female_xingganyujie_tob', // 性感御姐
  ICL_ZH_MALE_MS = 'ICL_zh_male_ms_tob', // 嚣张小哥
  ICL_ZH_MALE_YOU = 'ICL_zh_male_you_tob', // 油腻大叔
  ICL_ZH_MALE_GUAOGONGZI = 'ICL_zh_male_guaogongzi_v1_tob', // 孤傲公子
  ICL_ZH_MALE_HUZI = 'ICL_zh_male_huzi_v1_tob', // 胡子叔叔
  ICL_ZH_FEMALE_LUOQING = 'ICL_zh_female_luoqing_v1_tob', // 性感魅惑
  ZH_MALE_ZHOUJIELUN = 'zh_male_zhoujielun_emo_v2_mars_bigtts', // 双节棍小哥
  ICL_ZH_MALE_BINGRUOGONGZI = 'ICL_zh_male_bingruogongzi_tob', // 病弱公子
  ICL_ZH_FEMALE_BINGJIAO3 = 'ICL_zh_female_bingjiao3_tob', // 邪魅女王
  ICL_ZH_FEMALE_JIAXIAOZI = 'ICL_zh_female_jiaxiaozi_tob', // 假小子
  ICL_ZH_MALE_LENGJUNSHANGSI = 'ICL_zh_male_lengjunshangsi_tob', // 冷峻上司
  ICL_ZH_MALE_WENROUNANTONGZHUO = 'ICL_zh_male_wenrounantongzhuo_tob', // 温柔男同桌
  ICL_ZH_MALE_BINGJIAODIDI = 'ICL_zh_male_bingjiaodidi_tob', // 病娇弟弟
  ICL_ZH_MALE_YOUMODAYE = 'ICL_zh_male_youmodaye_tob', // 幽默大爷
  ICL_ZH_MALE_AOMANSHAOYE = 'ICL_zh_male_aomanshaoye_tob', // 傲慢少爷
  ICL_ZH_MALE_ASMRYEXIU = 'ICL_zh_male_asmryexiu_tob', // 枕边低语
  ICL_ZH_MALE_AOMANQINGNIAN = 'ICL_zh_male_aomanqingnian_tob', // 傲慢青年
  ICL_ZH_MALE_CUJINGNANYOU = 'ICL_zh_male_cujingnanyou_tob', // 醋精男友
  ICL_ZH_MALE_CUJINGNANSHENG = 'ICL_zh_male_cujingnansheng_tob', // 醋精男生
  ICL_ZH_MALE_SHUANGLANGSHAONIAN = 'ICL_zh_male_shuanglangshaonian_tob', // 爽朗少年
  ICL_ZH_MALE_SAJIAONANYOU = 'ICL_zh_male_sajiaonanyou_tob', // 撒娇男友
  ICL_ZH_MALE_WENROUNANYOU = 'ICL_zh_male_wenrounanyou_tob', // 温柔男友
  ICL_ZH_MALE_WENSHUNSHAONIAN = 'ICL_zh_male_wenshunshaonian_tob', // 温顺少年
  ICL_ZH_MALE_NAIGOUNANYOU = 'ICL_zh_male_naigounanyou_tob', // 粘人男友
  ICL_ZH_MALE_SAJIAONANSHENG = 'ICL_zh_male_sajiaonansheng_tob', // 撒娇男生
  ICL_ZH_MALE_HUOPONANYOU = 'ICL_zh_male_huoponanyou_tob', // 活泼男友
  ICL_ZH_MALE_TIANXINANYOU = 'ICL_zh_male_tianxinanyou_tob', // 甜系男友
  ICL_ZH_MALE_HUOLIQINGNIAN = 'ICL_zh_male_huoliqingnian_tob', // 活力青年
  ICL_ZH_MALE_KAILANGQINGNIAN = 'ICL_zh_male_kailangqingnian_tob', // 开朗青年
  ICL_ZH_MALE_LENGMOXIONGZHANG = 'ICL_zh_male_lengmoxiongzhang_tob', // 冷漠兄长
  ICL_ZH_MALE_TIANCAITONGZHUO = 'ICL_zh_male_tiancaitongzhuo_tob', // 天才同桌
  ICL_ZH_MALE_AOJIAOJINGYING = 'ICL_zh_male_aojiaojingying_tob', // 傲娇精英
  ICL_ZH_MALE_PIANPIANGONGZI = 'ICL_zh_male_pianpiangongzi_tob', // 翩翩公子
  ICL_ZH_MALE_MENGDONGQINGNIAN = 'ICL_zh_male_mengdongqingnian_tob', // 懵懂青年
  ICL_ZH_MALE_LENGLIANXIONGZHANG = 'ICL_zh_male_lenglianxiongzhang_tob', // 冷脸兄长
  ICL_ZH_MALE_BINGJIAOSHAONIAN = 'ICL_zh_male_bingjiaoshaonian_tob', // 病娇少年
  ICL_ZH_MALE_BINGJIAONANYOU = 'ICL_zh_male_bingjiaonanyou_tob', // 病娇男友
  ICL_ZH_MALE_BINGRUOSHAONIAN = 'ICL_zh_male_bingruoshaonian_tob', // 病弱少年
  ICL_ZH_MALE_YIQISHAONIAN = 'ICL_zh_male_yiqishaonian_tob', // 意气少年
  ICL_ZH_MALE_GANJINGSHAONIAN = 'ICL_zh_male_ganjingshaonian_tob', // 干净少年
  ICL_ZH_MALE_LENGMONANYOU = 'ICL_zh_male_lengmonanyou_tob', // 冷漠男友
  ICL_ZH_MALE_JINGYINGQINGNIAN = 'ICL_zh_male_jingyingqingnian_tob', // 精英青年
  ICL_ZH_MALE_FENGFASHAONIAN = 'ICL_zh_male_fengfashaonian_tob', // 风发少年
  ICL_ZH_MALE_REXUESHAONIAN = 'ICL_zh_male_rexueshaonian_tob', // 热血少年
  ICL_ZH_MALE_QINGSHUANGSHAONIAN = 'ICL_zh_male_qingshuangshaonian_tob', // 清爽少年
  ICL_ZH_MALE_ZHONGERQINGNIAN = 'ICL_zh_male_zhongerqingnian_tob', // 中二青年
  ICL_ZH_MALE_LINGYUNQINGNIAN = 'ICL_zh_male_lingyunqingnian_tob', // 凌云青年
  ICL_ZH_MALE_ZIFUQINGNIAN = 'ICL_zh_male_zifuqingnian_tob', // 自负青年
  ICL_ZH_MALE_BUJIQINGNIAN = 'ICL_zh_male_bujiqingnian_tob', // 不羁青年
  ICL_ZH_MALE_RUYAJUNZI = 'ICL_zh_male_ruyajunzi_tob', // 儒雅君子
  ICL_ZH_MALE_DIYINCHENYU = 'ICL_zh_male_diyinchenyu_tob', // 低音沉郁
  ICL_ZH_MALE_LENGLIANXUEBA = 'ICL_zh_male_lenglianxueba_tob', // 冷脸学霸
  ICL_ZH_MALE_RUYAZONGCAI = 'ICL_zh_male_ruyazongcai_tob', // 儒雅总裁
  ICL_ZH_MALE_SHENCHENZONGCAI = 'ICL_zh_male_shenchenzongcai_tob', // 深沉总裁
  ICL_ZH_MALE_XIAOHOUYE = 'ICL_zh_male_xiaohouye_tob', // 小侯爷
  ICL_ZH_MALE_GUGAOGONGZI = 'ICL_zh_male_gugaogongzi_tob', // 孤高公子
  ICL_ZH_MALE_ZHANGJIANJUNZI = 'ICL_zh_male_zhangjianjunzi_tob', // 仗剑君子
  ICL_ZH_MALE_WENRUNXUEZHE = 'ICL_zh_male_wenrunxuezhe_tob', // 温润学者
  ICL_ZH_MALE_QINQIEQINGNIAN = 'ICL_zh_male_qinqieqingnian_tob', // 亲切青年
  ICL_ZH_MALE_WENROUXUEZHANG = 'ICL_zh_male_wenrouxuezhang_tob', // 温柔学长
  ICL_ZH_MALE_CIXINGNANSANG = 'ICL_zh_male_cixingnansang_tob', // 磁性男嗓
  ICL_ZH_MALE_GAOLENGZONGCAI = 'ICL_zh_male_gaolengzongcai_tob', // 高冷总裁
  ICL_ZH_MALE_LENGJUNGAOZHI = 'ICL_zh_male_lengjungaozhi_tob', // 冷峻高智
  ICL_ZH_MALE_CHANRUOSHAOYE = 'ICL_zh_male_chanruoshaoye_tob', // 孱弱少爷
  ICL_ZH_MALE_ZIXINQINGNIAN = 'ICL_zh_male_zixinqingnian_tob', // 自信青年
  ICL_ZH_MALE_QINGSEQINGNIAN = 'ICL_zh_male_qingseqingnian_tob', // 青涩青年
  ICL_ZH_MALE_XUEBATONGZHUO = 'ICL_zh_male_xuebatongzhuo_tob', // 学霸同桌
  ICL_ZH_MALE_LENGAOZONGCAI = 'ICL_zh_male_lengaozongcai_tob', // 冷傲总裁
  ICL_ZH_MALE_BADAOSHAOYE = 'ICL_zh_male_badaoshaoye_tob', // 霸道少爷
  ICL_ZH_MALE_YUANQISHAONIAN = 'ICL_zh_male_yuanqishaonian_tob', // 元气少年
  ICL_ZH_MALE_SATUOQINGNIAN = 'ICL_zh_male_satuoqingnian_tob', // 洒脱青年
  ICL_ZH_MALE_ZHISHUAIQINGNIAN = 'ICL_zh_male_zhishuaiqingnian_tob', // 直率青年
  ICL_ZH_MALE_SIWENQINGNIAN = 'ICL_zh_male_siwenqingnian_tob', // 斯文青年
  ICL_ZH_MALE_CHENGSHUZONGCAI = 'ICL_zh_male_chengshuzongcai_tob', // 成熟总裁
  ICL_ZH_MALE_JUNYIGONGZI = 'ICL_zh_male_junyigongzi_tob', // 俊逸公子
  ICL_ZH_MALE_AOJIAOGONGZI = 'ICL_zh_male_aojiaogongzi_tob', // 傲娇公子
  ICL_ZH_MALE_ZHANGJIANXIAKE = 'ICL_zh_male_zhangjianxiake_tob', // 仗剑侠客
  ICL_ZH_MALE_JIJIAOZHINENG = 'ICL_zh_male_jijiaozhineng_tob', // 机甲智能
  ICL_ZH_MALE_SHENMIFASHI = 'ICL_zh_male_shenmifashi_tob', // 神秘法师
  ICL_ZH_MALE_BADAOZONGCAI = 'ICL_zh_male_badaozongcai_v1_tob', // 霸道总裁

  // 视频配音
  ZH_MALE_M100 = 'zh_male_M100_conversation_wvae_bigtts', // 悠悠君子
  ZH_FEMALE_MAOMAO = 'zh_female_maomao_conversation_wvae_bigtts', // 文静毛毛
  ICL_ZH_FEMALE_QIULING = 'ICL_zh_female_qiuling_v1_tob', // 倾心少女
  ICL_ZH_MALE_BUYAN = 'ICL_zh_male_buyan_v1_tob', // 醇厚低音
  ICL_ZH_MALE_PAOXIAOGE = 'ICL_zh_male_BV144_paoxiaoge_v1_tob', // 咆哮小哥
  ICL_ZH_FEMALE_HEAINAINAI = 'ICL_zh_female_heainainai_tob', // 和蔼奶奶
  ICL_ZH_FEMALE_LINJUAYI = 'ICL_zh_female_linjuayi_tob', // 邻居阿姨
  ZH_FEMALE_WENROUXIAOYA = 'zh_female_wenrouxiaoya_moon_bigtts', // 温柔小雅
  ZH_MALE_TIANCAITONGSHENG = 'zh_male_tiancaitongsheng_mars_bigtts', // 天才童声
  ZH_MALE_SUNWUKONG = 'zh_male_sunwukong_mars_bigtts', // 猴哥
  ZH_MALE_XIONGER = 'zh_male_xionger_mars_bigtts', // 熊二
  ZH_FEMALE_PEIQI = 'zh_female_peiqi_mars_bigtts', // 佩奇猪
  ZH_FEMALE_WUZETIAN = 'zh_female_wuzetian_mars_bigtts', // 武则天
  ZH_FEMALE_GUJIE = 'zh_female_gujie_mars_bigtts', // 顾姐
  ZH_FEMALE_YINGTAOWANZI = 'zh_female_yingtaowanzi_mars_bigtts', // 樱桃丸子
  ZH_MALE_CHUNHUI = 'zh_male_chunhui_mars_bigtts', // 广告解说
  ZH_FEMALE_SHAOERGUSHI = 'zh_female_shaoergushi_mars_bigtts', // 少儿故事
  ZH_MALE_SILANG = 'zh_male_silang_mars_bigtts', // 四郎
  ZH_MALE_JIESHUONANSHENG = 'zh_male_jieshuonansheng_mars_bigtts', // 磁性解说男声/Morgan
  ZH_FEMALE_JITANGMEIMEI = 'zh_female_jitangmeimei_mars_bigtts', // 鸡汤妹妹/Hope
  ZH_FEMALE_TIEXINNVSHENG = 'zh_female_tiexinnvsheng_mars_bigtts', // 贴心女声/Candy
  ZH_FEMALE_QIAOPINVSHENG = 'zh_female_qiaopinvsheng_mars_bigtts', // 俏皮女声
  ZH_FEMALE_MENGYATOU = 'zh_female_mengyatou_mars_bigtts', // 萌丫头/Cutey
  ZH_MALE_LANXIAOYANG = 'zh_male_lanxiaoyang_mars_bigtts', // 懒音绵宝
  ZH_MALE_DONGMANHAIMIAN = 'zh_male_dongmanhaimian_mars_bigtts', // 亮嗓萌仔

  // 有声阅读
  ICL_ZH_MALE_YANGYANG = 'ICL_zh_male_yangyang_v1_tob', // 温暖少年
  ICL_ZH_MALE_FLC = 'ICL_zh_male_flc_v1_tob', // 儒雅公子
  ZH_MALE_CHANGTIANYI = 'zh_male_changtianyi_mars_bigtts', // 悬疑解说
  ZH_MALE_RUYAQINGNIAN = 'zh_male_ruyaqingnian_mars_bigtts', // 儒雅青年
  ZH_MALE_BAQIQINGSHU = 'zh_male_baqiqingshu_mars_bigtts', // 霸气青叔
  ZH_MALE_QINGCANG = 'zh_male_qingcang_mars_bigtts', // 擎苍
  ZH_MALE_YANGGUANGQINGNIAN_MARS = 'zh_male_yangguangqingnian_mars_bigtts', // 活力小哥
  ZH_FEMALE_GUFENGSHAOYU = 'zh_female_gufengshaoyu_mars_bigtts', // 古风少御
  ZH_FEMALE_WENROUSHUNV = 'zh_female_wenroushunv_mars_bigtts', // 温柔淑女
  ZH_MALE_FANJUANQINGNIAN = 'zh_male_fanjuanqingnian_mars_bigtts', // 反卷青年

  // 默认推荐音色
  ZH_MALE_CONVERSATION = 'zh_male_M392_conversation_wvae_bigtts', // 中文男声-对话（原默认）
}

// 音频编码格式
export enum AudioEncoding {
  MP3 = 'mp3',
  WAV = 'wav',
  PCM = 'pcm',
  OGG_OPUS = 'ogg_opus'
}

// TTS 配置
export interface TTSConfig {
  appid: string;
  token: string;
  cluster?: string;
  defaultVoiceType?: string;
  defaultSpeedRatio?: number;
}

// TTS 合成选项
export interface TTSSynthesizeOptions {
  text: string;
  voiceType?: string;
  speedRatio?: number;
  encoding?: AudioEncoding;
  userId?: string;
  // 大模型特有参数
  emotion?: string; // 情感设置
  enableEmotion?: boolean; // 是否启用情感
  emotionScale?: number; // 情绪值 (1-5)
  rate?: number; // 采样率
  loudnessRatio?: number; // 音量调节 (0.5-2)
  withTimestamp?: boolean; // 是否返回时间戳
  textType?: 'plain' | 'ssml'; // 文本类型
  silenceDuration?: number; // 句尾静音
  operation?: 'query' | 'submit'; // 操作类型 (query:非流式, submit:流式)
  disableMarkdownFilter?: boolean; // 禁用markdown过滤
  enableLatexTn?: boolean; // 启用LaTeX公式播报
  explicitLanguage?: string; // 明确语种
  contextLanguage?: string; // 参考语种
}

// TTS 错误
export class TTSError extends Error {
  code: number;
  
  constructor(code: number, message: string) {
    super(message);
    this.name = 'TTSError';
    this.code = code;
  }
}

// WebSocket 二进制协议相关类型
export interface BinaryProtocolHeader {
  protocolVersion: number;
  headerSize: number;
  messageType: number;
  messageTypeSpecificFlags: number;
  serializationMethod: number;
  compressionMethod: number;
  reserved: number;
}

// 消息类型
export enum MessageType {
  FULL_CLIENT_REQUEST = 0b0001,
  AUDIO_ONLY_SERVER_RESPONSE = 0b1011,
  ERROR_MESSAGE = 0b1111
}

// 序列化方法
export enum SerializationMethod {
  RAW = 0b0000,
  JSON = 0b0001,
  CUSTOM = 0b1111
}

// 压缩方法
export enum CompressionMethod {
  NONE = 0b0000,
  GZIP = 0b0001,
  CUSTOM = 0b1111
}

// 额外参数接口
export interface ExtraParams {
  mute_cut_threshold?: string;
  mute_cut_remain_ms?: string;
  disable_emoji_filter?: boolean;
  unsupported_char_ratio_thresh?: number;
  cache_config?: {
    text_type: number;
    use_cache: boolean;
  };
  disable_markdown_filter?: boolean;
  enable_latex_tn?: boolean;
}

// 音色信息接口
export interface VoiceInfo {
  id: string;
  name: string;
  description: string;
  language: string;
  gender: 'male' | 'female';
  category: '多情感' | '英文多情感' | '教育场景' | '客服场景' | '通用场景' | '多语种' | '日语西语' | '趣味口音' | '角色扮演' | '视频配音' | '有声阅读' | '推荐';
  emotions?: string[];
  accent?: string;
  features?: string[];
}

// 音色信息映射
export const VOICE_INFO_MAP: Record<string, VoiceInfo> = {
  // 多情感音色
  [VoiceType.ZH_MALE_BEIJINGXIAOYE_EMO]: {
    id: VoiceType.ZH_MALE_BEIJINGXIAOYE_EMO,
    name: '北京小爷（多情感）',
    description: '北京口音男声，支持多种情感表达',
    language: '中文',
    gender: 'male',
    category: '多情感',
    emotions: ['angry', 'surprised', 'fear', 'excited', 'coldness', 'neutral'],
    accent: '北京口音'
  },
  [VoiceType.ZH_FEMALE_ROUMEINVYOU_EMO]: {
    id: VoiceType.ZH_FEMALE_ROUMEINVYOU_EMO,
    name: '柔美女友（多情感）',
    description: '温柔女声，适合情感丰富的内容',
    language: '中文',
    gender: 'female',
    category: '多情感',
    emotions: ['happy', 'sad', 'angry', 'surprised', 'fear', 'hate', 'excited', 'coldness', 'neutral']
  },
  [VoiceType.ZH_MALE_YANGGUANGQINGNIAN_EMO]: {
    id: VoiceType.ZH_MALE_YANGGUANGQINGNIAN_EMO,
    name: '阳光青年（多情感）',
    description: '充满活力的年轻男声',
    language: '中文',
    gender: 'male',
    category: '多情感',
    emotions: ['happy', 'sad', 'angry', 'fear', 'excited', 'coldness', 'neutral']
  },
  [VoiceType.ZH_FEMALE_MEILINVYOU_EMO]: {
    id: VoiceType.ZH_FEMALE_MEILINVYOU_EMO,
    name: '魅力女友（多情感）',
    description: '具有魅力的女声，情感表达细腻',
    language: '中文',
    gender: 'female',
    category: '多情感',
    emotions: ['sad', 'fear', 'neutral']
  },
  [VoiceType.ZH_FEMALE_SHUANGKUAISISI_EMO]: {
    id: VoiceType.ZH_FEMALE_SHUANGKUAISISI_EMO,
    name: '爽快思思（多情感）',
    description: '活泼开朗的女声，支持中英文混合',
    language: '中文、美式英语',
    gender: 'female',
    category: '多情感',
    emotions: ['happy', 'sad', 'angry', 'surprised', 'excited', 'coldness', 'neutral']
  },
  
  // 英文多情感音色
  [VoiceType.EN_MALE_GLEN_EMO]: {
    id: VoiceType.EN_MALE_GLEN_EMO,
    name: 'Glen（多情感）',
    description: '美式英语男声，情感丰富',
    language: '美式英语',
    gender: 'male',
    category: '英文多情感',
    emotions: ['affectionate', 'angry', 'asmr', 'chat', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  [VoiceType.EN_MALE_SYLUS_EMO]: {
    id: VoiceType.EN_MALE_SYLUS_EMO,
    name: 'Sylus（多情感）',
    description: '美式英语男声，权威深沉',
    language: '美式英语',
    gender: 'male',
    category: '英文多情感',
    emotions: ['affectionate', 'angry', 'asmr', 'authoritative', 'chat', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  [VoiceType.EN_FEMALE_CANDICE_EMO]: {
    id: VoiceType.EN_FEMALE_CANDICE_EMO,
    name: 'Candice（多情感）',
    description: '美式英语女声，温暖亲切',
    language: '美式英语',
    gender: 'female',
    category: '英文多情感',
    emotions: ['affectionate', 'angry', 'asmr', 'chat', 'excited', 'happy', 'neutral', 'warm']
  },
  [VoiceType.EN_MALE_COREY_EMO]: {
    id: VoiceType.EN_MALE_COREY_EMO,
    name: 'Corey（多情感）',
    description: '英式英语男声，情感表达细腻',
    language: '英式英语',
    gender: 'male',
    category: '英文多情感',
    emotions: ['angry', 'asmr', 'authoritative', 'chat', 'affectionate', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  [VoiceType.EN_FEMALE_NADIA_EMO]: {
    id: VoiceType.EN_FEMALE_NADIA_EMO,
    name: 'Nadia（多情感）',
    description: '英式英语女声，优雅动人',
    language: '英式英语',
    gender: 'female',
    category: '英文多情感',
    emotions: ['affectionate', 'angry', 'asmr', 'chat', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  [VoiceType.EN_FEMALE_SERENA_EMO]: {
    id: VoiceType.EN_FEMALE_SERENA_EMO,
    name: 'Serena（多情感）',
    description: '美式英语女声，活泼生动',
    language: '美式英语',
    gender: 'female',
    category: '英文多情感',
    emotions: ['affectionate', 'angry', 'asmr', 'chat', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  [VoiceType.EN_FEMALE_NADIA_POETRY]: {
    id: VoiceType.EN_FEMALE_NADIA_POETRY,
    name: 'Nadia Poetry（多情感）',
    description: '美式英语女声，诗意优雅',
    language: '美式英语',
    gender: 'female',
    category: '英文多情感',
    emotions: ['asmr', 'affectionate', 'angry', 'chat', 'excited', 'happy', 'neutral', 'sad', 'warm']
  },
  
  // 教育场景
  [VoiceType.ZH_FEMALE_TINA_TEACHER]: {
    id: VoiceType.ZH_FEMALE_TINA_TEACHER,
    name: 'Tina老师',
    description: '专业教师声音，适合英语教学',
    language: '中、英式英语',
    gender: 'female',
    category: '教育场景',
    features: ['教学专用', '中英双语', '专业发音']
  },

  // 客服场景
  [VoiceType.ZH_FEMALE_KEFU]: {
    id: VoiceType.ZH_FEMALE_KEFU,
    name: '暖阳女声',
    description: '温暖亲切的客服女声',
    language: '仅中文',
    gender: 'female',
    category: '客服场景',
    features: ['客服专用', '温暖亲切', '专业服务']
  },

  // 推荐音色（精选常用）
  [VoiceType.ZH_MALE_CONVERSATION]: {
    id: VoiceType.ZH_MALE_CONVERSATION,
    name: '中文男声-对话',
    description: '标准中文男声，适合日常对话和阅读',
    language: '中文',
    gender: 'male',
    category: '推荐',
    features: ['对话优化', '发音清晰', '通用性强']
  },
  [VoiceType.ZH_FEMALE_SHUANGKUAISISI]: {
    id: VoiceType.ZH_FEMALE_SHUANGKUAISISI,
    name: '爽快思思/Skye',
    description: '活泼开朗的女声，支持中英文混合',
    language: '中文、美式英语',
    gender: 'female',
    category: '推荐',
    features: ['中英混合', '活泼开朗', '适合年轻内容']
  },
  [VoiceType.ZH_MALE_WENNUANAHU]: {
    id: VoiceType.ZH_MALE_WENNUANAHU,
    name: '温暖阿虎/Alvin',
    description: '温暖亲切的男声，支持中英文',
    language: '中文、美式英语',
    gender: 'male',
    category: '推荐',
    features: ['温暖亲切', '中英混合', '适合教育内容']
  },
  [VoiceType.ZH_MALE_SHAONIANZIXIN]: {
    id: VoiceType.ZH_MALE_SHAONIANZIXIN,
    name: '少年梓辛/Brayan',
    description: '青春活力的男声，支持中英文',
    language: '中文、美式英语',
    gender: 'male',
    category: '推荐',
    features: ['青春活力', '中英混合', '适合年轻人']
  },

  // 角色扮演（精选热门）
  [VoiceType.ZH_MALE_SUNWUKONG]: {
    id: VoiceType.ZH_MALE_SUNWUKONG,
    name: '猴哥',
    description: '经典动画角色孙悟空的声音',
    language: '中文',
    gender: 'male',
    category: '角色扮演',
    features: ['经典角色', '儿童喜爱', '动画配音']
  },
  [VoiceType.ZH_MALE_XIONGER]: {
    id: VoiceType.ZH_MALE_XIONGER,
    name: '熊二',
    description: '憨厚可爱的熊二声音',
    language: '中文',
    gender: 'male',
    category: '角色扮演',
    features: ['憨厚可爱', '儿童内容', '动画角色']
  },
  [VoiceType.ZH_FEMALE_PEIQI]: {
    id: VoiceType.ZH_FEMALE_PEIQI,
    name: '佩奇猪',
    description: '小猪佩奇的可爱声音',
    language: '中文',
    gender: 'female',
    category: '角色扮演',
    features: ['可爱童真', '儿童喜爱', '卡通角色']
  },

  // 趣味口音（精选）
  [VoiceType.ZH_FEMALE_WANWANXIAOHE]: {
    id: VoiceType.ZH_FEMALE_WANWANXIAOHE,
    name: '湾湾小何',
    description: '台湾口音女声，亲切自然',
    language: '中文',
    gender: 'female',
    category: '趣味口音',
    accent: '台湾口音',
    features: ['台湾口音', '亲切自然']
  },
  [VoiceType.ZH_FEMALE_DAIMENGCHUANMEI]: {
    id: VoiceType.ZH_FEMALE_DAIMENGCHUANMEI,
    name: '呆萌川妹',
    description: '四川口音女声，活泼可爱',
    language: '中文',
    gender: 'female',
    category: '趣味口音',
    accent: '四川口音',
    features: ['四川口音', '活泼可爱']
  },

  // 视频配音（热门）
  [VoiceType.ZH_MALE_JIESHUONANSHENG]: {
    id: VoiceType.ZH_MALE_JIESHUONANSHENG,
    name: '磁性解说男声/Morgan',
    description: '专业解说声音，磁性浑厚',
    language: '中文、美式英语',
    gender: 'male',
    category: '视频配音',
    features: ['磁性浑厚', '专业解说', '中英混合']
  },
  [VoiceType.ZH_MALE_CHANGTIANYI]: {
    id: VoiceType.ZH_MALE_CHANGTIANYI,
    name: '悬疑解说',
    description: '悬疑故事专用声音，营造氛围',
    language: '中文',
    gender: 'male',
    category: '有声阅读',
    features: ['悬疑氛围', '故事解说', '沉浸感强']
  }
};

// 根据voice_type字符串动态生成音色信息
function generateVoiceInfoFromType(voiceType: string): VoiceInfo | null {
  // 解析voice_type字符串结构
  const parts = voiceType.split('_');
  if (parts.length < 3) return null;
  
  let language = '中文';
  let gender: 'male' | 'female' = 'male';
  let category: VoiceInfo['category'] = '通用场景';
  let name = voiceType;
  let description = `音色 ${voiceType}`;
  let emotions: string[] = [];
  let accent: string = '';
  let features: string[] = [];

  // 解析语种
  if (parts[0] === 'zh') language = '中文';
  else if (parts[0] === 'en') language = '英语';
  else if (parts[0] === 'multi') language = '多语种';
  else if (parts[0] === 'ICL') language = '中文';

  // 解析性别
  if (parts[1] === 'male') gender = 'male';
  else if (parts[1] === 'female') gender = 'female';

  // 特殊音色名称映射
  const specialNames: Record<string, { name: string, description: string, category?: VoiceInfo['category'], emotions?: string[], accent?: string, features?: string[], language?: string }> = {
    // 多情感音色详细信息
    'zh_female_tianxinxiaomei_emo_v2_mars_bigtts': { name: '甜心小美（多情感）', description: '甜美可爱的女声', category: '多情感', emotions: ['sad', 'fear', 'hate', 'neutral'] },
    'zh_male_guangzhoudege_emo_mars_bigtts': { name: '广州德哥（多情感）', description: '广东方言男声', category: '多情感', accent: '广东口音', emotions: ['angry', 'fear', 'neutral'] },
    'zh_male_jingqiangkanye_emo_mars_bigtts': { name: '京腔侃爷（多情感）', description: '北京方言男声', category: '多情感', accent: '北京口音', emotions: ['happy', 'angry', 'surprised', 'hate', 'neutral'] },
    'zh_female_linjuayi_emo_v2_mars_bigtts': { name: '邻居阿姨（多情感）', description: '亲切邻家阿姨声音', category: '多情感', emotions: ['neutral', 'angry', 'coldness', 'sad', 'surprised'] },
    'zh_male_yourougongzi_emo_v2_mars_bigtts': { name: '优柔公子（多情感）', description: '温和书生气质男声', category: '多情感', emotions: ['happy', 'angry', 'fear', 'hate', 'excited', 'neutral', 'sad'] },
    'zh_male_ruyayichen_emo_v2_mars_bigtts': { name: '儒雅男友（多情感）', description: '文雅绅士男声', category: '多情感', emotions: ['happy', 'sad', 'angry', 'fear', 'excited', 'coldness', 'neutral'] },
    'zh_male_junlangnanyou_emo_v2_mars_bigtts': { name: '俊朗男友（多情感）', description: '帅气男友声音', category: '多情感', emotions: ['happy', 'sad', 'angry', 'surprised', 'fear', 'neutral'] },
    'zh_male_lengkugege_emo_v2_mars_bigtts': { name: '冷酷哥哥（多情感）', description: '高冷男声', category: '多情感', emotions: ['angry', 'coldness', 'fear', 'happy', 'hate', 'neutral', 'sad', 'depressed'] },

    // 通用场景音色
    'zh_female_tianmeitaozi_mars_bigtts': { name: '甜美桃子', description: '甜美清新的女声', category: '通用场景', language: '中文' },
    'zh_female_vv_mars_bigtts': { name: 'Vivi', description: '活泼可爱的女声', category: '通用场景', language: '中文' },
    'zh_female_cancan_mars_bigtts': { name: '灿灿/Shiny', description: '阳光灿烂的女声', category: '通用场景', language: '中文、美式英语' },
    'zh_female_qingxinnvsheng_mars_bigtts': { name: '清新女声', description: '清新自然的女声', category: '通用场景', language: '中文' },
    'zh_female_linjianvhai_moon_bigtts': { name: '邻家女孩', description: '邻家女孩般的亲切声音', category: '通用场景', language: '中文' },
    'zh_male_yuanboxiaoshu_moon_bigtts': { name: '渊博小叔', description: '知识渊博的成熟男声', category: '通用场景', language: '中文' },
    'zh_female_tianmeixiaoyuan_moon_bigtts': { name: '甜美小源', description: '甜美温柔的女声', category: '通用场景', language: '中文' },
    'zh_female_qingchezizi_moon_bigtts': { name: '清澈梓梓', description: '清澈纯净的女声', category: '通用场景', language: '中文' },
    'zh_male_jieshuoxiaoming_moon_bigtts': { name: '解说小明', description: '专业解说男声', category: '通用场景', language: '中文' },
    'zh_female_kailangjiejie_moon_bigtts': { name: '开朗姐姐', description: '开朗大方的女声', category: '通用场景', language: '中文' },
    'zh_male_linjiananhai_moon_bigtts': { name: '邻家男孩', description: '邻家男孩般的亲切声音', category: '通用场景', language: '中文' },
    'zh_female_tianmeiyueyue_moon_bigtts': { name: '甜美悦悦', description: '甜美动人的女声', category: '通用场景', language: '中文' },
    'zh_female_xinlingjitang_moon_bigtts': { name: '心灵鸡汤', description: '温暖治愈的女声', category: '通用场景', language: '中文' },
    'zh_female_qinqienvsheng_moon_bigtts': { name: '亲切女声', description: '亲切温和的女声', category: '通用场景', language: '中文' },
    'zh_female_shuangkuaisisi_moon_bigtts': { name: '爽快思思/Skye', description: '活泼开朗的女声', category: '通用场景', language: '中文、美式英语' },
    'zh_male_wennuanahu_moon_bigtts': { name: '温暖阿虎/Alvin', description: '温暖亲切的男声', category: '通用场景', language: '中文、美式英语' },
    'zh_male_shaonianzixin_moon_bigtts': { name: '少年梓辛/Brayan', description: '青春活力的男声', category: '通用场景', language: '中文、美式英语' },
    'zh_female_zhixingnvsheng_mars_bigtts': { name: '知性女声', description: '知性优雅的女声', category: '通用场景', language: '中文' },
    'zh_male_qingshuangnanda_mars_bigtts': { name: '清爽男大', description: '清爽大男孩声音', category: '通用场景', language: '中文' },
    'zh_male_yangguangqingnian_moon_bigtts': { name: '阳光青年', description: '充满活力的年轻男声', category: '通用场景', language: '中文' },
    'zh_male_wenrouxiaoge_mars_bigtts': { name: '温柔小哥', description: '温柔体贴的男声', category: '通用场景', language: '中文' },
    'zh_male_qingyiyuxuan_mars_bigtts': { name: '阳光阿辰', description: '阳光帅气的男声', category: '通用场景', language: '中文' },
    'zh_male_xudong_conversation_wvae_bigtts': { name: '快乐小东', description: '快乐活泼的男声', category: '通用场景', language: '中文' },
    'en_male_jason_conversation_wvae_bigtts': { name: '开朗学长', description: '开朗亲切的男声', category: '通用场景', language: '中文' },
    'zh_female_sophie_conversation_wvae_bigtts': { name: '魅力苏菲', description: '魅力优雅的女声', category: '通用场景', language: '中文' },

    // ICL通用场景音色
    'ICL_zh_female_zhixingwenwan_tob': { name: '知性温婉', description: '知性优雅的女声', category: '通用场景', language: '中文' },
    'ICL_zh_male_nuanxintitie_tob': { name: '暖心体贴', description: '体贴温暖的男声', category: '通用场景', language: '中文' },
    'ICL_zh_female_wenrouwenya_tob': { name: '温柔文雅', description: '文雅温柔的女声', category: '通用场景', language: '中文' },
    'ICL_zh_male_kailangqingkuai_tob': { name: '开朗轻快', description: '开朗活泼的男声', category: '通用场景', language: '中文' },
    'ICL_zh_male_huoposhuanglang_tob': { name: '活泼爽朗', description: '爽朗大方的男声', category: '通用场景', language: '中文' },
    'ICL_zh_male_shuaizhenxiaohuo_tob': { name: '率真小伙', description: '直率真诚的男声', category: '通用场景', language: '中文' },
    'ICL_zh_male_shenmi_v1_tob': { name: '机灵小伙', description: '机灵活泼的男声', category: '通用场景', language: '中文' },
    'ICL_zh_female_wuxi_tob': { name: '元气甜妹', description: '元气满满的甜美女声', category: '通用场景', language: '中文' },
    'ICL_zh_female_wenyinvsheng_v1_tob': { name: '知心姐姐', description: '贴心温柔的女声', category: '通用场景', language: '中文' },
    'ICL_zh_male_lengkugege_v1_tob': { name: '冷酷哥哥', description: '高冷酷酷的男声', category: '通用场景', language: '中文' },
    'ICL_zh_female_feicui_v1_tob': { name: '纯澈女生', description: '纯净清澈的女声', category: '通用场景', language: '中文' },
    'ICL_zh_female_yuxin_v1_tob': { name: '初恋女友', description: '甜美青涩的女声', category: '通用场景', language: '中文' },
    'ICL_zh_female_xnx_tob': { name: '贴心闺蜜', description: '贴心温暖的女声', category: '通用场景', language: '中文' },
    'ICL_zh_female_yry_tob': { name: '温柔白月光', description: '温柔优雅的女声', category: '通用场景', language: '中文' },
    'ICL_zh_female_yilin_tob': { name: '贴心妹妹', description: '可爱贴心的女声', category: '通用场景', language: '中文' },

    // 趣味口音
    'zh_male_jingqiangkanye_moon_bigtts': { name: '京腔侃爷/Harmony', description: '北京方言男声，支持中英文', category: '趣味口音', accent: '北京口音', language: '中文-北京口音、英文' },
    'zh_female_wanwanxiaohe_moon_bigtts': { name: '湾湾小何', description: '台湾口音女声，亲切自然', category: '趣味口音', accent: '台湾口音', language: '中文-台湾口音' },
    'zh_female_wanqudashu_moon_bigtts': { name: '湾区大叔', description: '广东口音成熟声音', category: '趣味口音', accent: '广东口音', language: '中文-广东口音' },
    'zh_female_daimengchuanmei_moon_bigtts': { name: '呆萌川妹', description: '四川口音女声，活泼可爱', category: '趣味口音', accent: '四川口音', language: '中文-四川口音' },
    'zh_male_guozhoudege_moon_bigtts': { name: '广州德哥', description: '广东口音男声', category: '趣味口音', accent: '广东口音', language: '中文-广东口音' },
    'zh_male_beijingxiaoye_moon_bigtts': { name: '北京小爷', description: '北京口音男声', category: '趣味口音', accent: '北京口音', language: '中文-北京口音' },
    'zh_male_haoyuxiaoge_moon_bigtts': { name: '浩宇小哥', description: '青岛口音男声', category: '趣味口音', accent: '青岛口音', language: '中文-青岛口音' },
    'zh_male_guangxiyuanzhou_moon_bigtts': { name: '广西远舟', description: '广西口音男声', category: '趣味口音', accent: '广西口音', language: '中文-广西口音' },
    'zh_female_meituojieer_moon_bigtts': { name: '妹坨洁儿', description: '长沙口音女声', category: '趣味口音', accent: '长沙口音', language: '中文-长沙口音' },
    'zh_male_yuzhouzixuan_moon_bigtts': { name: '豫州子轩', description: '河南口音男声', category: '趣味口音', accent: '河南口音', language: '中文-河南口音' },

    // 角色扮演
    'zh_male_naiqimengwa_mars_bigtts': { name: '奶气萌娃', description: '可爱童声', category: '角色扮演', features: ['童声', '可爱'], language: '中文' },
    'zh_female_popo_mars_bigtts': { name: '婆婆', description: '慈祥老奶奶声音', category: '角色扮演', features: ['长辈', '慈祥'], language: '中文' },
    'zh_female_gaolengyujie_moon_bigtts': { name: '高冷御姐', description: '高冷御姐声音', category: '角色扮演', features: ['御姐', '高冷'], language: '中文' },
    'zh_male_aojiaobazong_moon_bigtts': { name: '傲娇霸总', description: '傲娇霸道总裁声音', category: '角色扮演', features: ['霸总', '傲娇'], language: '中文' },
    'zh_female_meilinvyou_moon_bigtts': { name: '魅力女友', description: '魅力女友声音', category: '角色扮演', features: ['女友', '魅力'], language: '中文' },
    'zh_male_shenyeboke_moon_bigtts': { name: '深夜播客', description: '深夜电台主播声音', category: '角色扮演', features: ['磁性', '深夜'], language: '中文' },
    'zh_female_sajiaonvyou_moon_bigtts': { name: '柔美女友', description: '撒娇女友声音', category: '角色扮演', features: ['撒娇', '甜美'], language: '中文' },
    'zh_female_yuanqinvyou_moon_bigtts': { name: '撒娇学妹', description: '可爱学妹声音', category: '角色扮演', features: ['学生', '可爱'], language: '中文' },
    'ICL_zh_female_bingruoshaonv_tob': { name: '病弱少女', description: '柔弱病娇的少女声音', category: '角色扮演', features: ['病弱', '少女'], language: '中文' },
    'ICL_zh_female_huoponvhai_tob': { name: '活泼女孩', description: '活泼开朗的女孩声音', category: '角色扮演', features: ['活泼', '女孩'], language: '中文' },
    'zh_male_dongfanghaoran_moon_bigtts': { name: '东方浩然', description: '古风男声', category: '角色扮演', features: ['古风', '侠客'], language: '中文' },
    'ICL_zh_male_lvchaxiaoge_tob': { name: '绿茶小哥', description: '温柔绿茶系男声', category: '角色扮演', features: ['绿茶', '温柔'], language: '中文' },
    'ICL_zh_female_jiaoruoluoli_tob': { name: '娇弱萝莉', description: '娇弱可爱的萝莉声音', category: '角色扮演', features: ['萝莉', '娇弱'], language: '中文' },
    'ICL_zh_male_bingjiaogege_tob': { name: '病娇哥哥', description: '病娇哥哥声音', category: '角色扮演', features: ['病娇', '哥哥'], language: '中文' },
    'ICL_zh_male_wenrounanyou_tob': { name: '温柔男友', description: '温柔体贴的男友声音', category: '角色扮演', features: ['温柔', '男友'], language: '中文' },
    'ICL_zh_female_tiexinnvyou_tob': { name: '贴心女友', description: '贴心温暖的女友声音', category: '角色扮演', features: ['贴心', '女友'], language: '中文' },
    'ICL_zh_male_youmoshushu_tob': { name: '幽默叔叔', description: '幽默风趣的叔叔声音', category: '角色扮演', features: ['幽默', '叔叔'], language: '中文' },
    'zh_male_zhoujielun_emo_v2_mars_bigtts': { name: '双节棍小哥', description: '台湾口音男声', category: '角色扮演', features: ['台湾口音', '流行'], language: '中文-台湾口音' },
    'ICL_zh_male_lengdanshuli_tob': { name: '冷淡疏离', description: '冷淡疏离的男声', category: '角色扮演', features: ['冷淡', '疏离'], language: '中文' },
    'ICL_zh_male_hanhoudunshi_tob': { name: '憨厚敦实', description: '憨厚敦实的男声', category: '角色扮演', features: ['憨厚', '敦实'], language: '中文' },
    'ICL_zh_male_aiqilingren_tob': { name: '傲气凌人', description: '傲气凌人的男声', category: '角色扮演', features: ['傲气', '凌人'], language: '中文' },
    'ICL_zh_female_huopodiaoman_tob': { name: '活泼刁蛮', description: '活泼刁蛮的女声', category: '角色扮演', features: ['活泼', '刁蛮'], language: '中文' },
    'ICL_zh_male_guzhibingjiao_tob': { name: '固执病娇', description: '固执病娇的男声', category: '角色扮演', features: ['固执', '病娇'], language: '中文' },
    'ICL_zh_male_sajiaonianren_tob': { name: '撒娇粘人', description: '撒娇粘人的男声', category: '角色扮演', features: ['撒娇', '粘人'], language: '中文' },
    'ICL_zh_female_aomanjiaosheng_tob': { name: '傲慢娇声', description: '傲慢娇声的女声', category: '角色扮演', features: ['傲慢', '娇声'], language: '中文' },
    'ICL_zh_male_xiaosasuixing_tob': { name: '潇洒随性', description: '潇洒随性的男声', category: '角色扮演', features: ['潇洒', '随性'], language: '中文' },
    'ICL_zh_male_fuheigongzi_tob': { name: '腹黑公子', description: '腹黑公子声音', category: '角色扮演', features: ['腹黑', '公子'], language: '中文' },
    'ICL_zh_male_guiyishenmi_tob': { name: '诡异神秘', description: '诡异神秘的男声', category: '角色扮演', features: ['诡异', '神秘'], language: '中文' },
    'ICL_zh_male_ruyacaijun_tob': { name: '儒雅才俊', description: '儒雅才俊的男声', category: '角色扮演', features: ['儒雅', '才俊'], language: '中文' },
    'ICL_zh_male_bingjiaobailian_tob': { name: '病娇白莲', description: '病娇白莲的男声', category: '角色扮演', features: ['病娇', '白莲'], language: '中文' },
    'ICL_zh_male_zhengzhiqingnian_tob': { name: '正直青年', description: '正直青年声音', category: '角色扮演', features: ['正直', '青年'], language: '中文' },
    'ICL_zh_female_jiaohannvwang_tob': { name: '娇憨女王', description: '娇憨女王声音', category: '角色扮演', features: ['娇憨', '女王'], language: '中文' },
    'ICL_zh_female_bingjiaomengmei_tob': { name: '病娇萌妹', description: '病娇萌妹声音', category: '角色扮演', features: ['病娇', '萌妹'], language: '中文' },
    'ICL_zh_male_qingsenaigou_tob': { name: '青涩小生', description: '青涩小生声音', category: '角色扮演', features: ['青涩', '小生'], language: '中文' },
    'ICL_zh_male_chunzhenxuedi_tob': { name: '纯真学弟', description: '纯真学弟声音', category: '角色扮演', features: ['纯真', '学弟'], language: '中文' },
    'ICL_zh_female_nuanxinxuejie_tob': { name: '暖心学姐', description: '暖心学姐声音', category: '角色扮演', features: ['暖心', '学姐'], language: '中文' },
    'ICL_zh_female_keainvsheng_tob': { name: '可爱女生', description: '可爱女生声音', category: '角色扮演', features: ['可爱', '女生'], language: '中文' },
    'ICL_zh_female_chengshujiejie_tob': { name: '成熟姐姐', description: '成熟姐姐声音', category: '角色扮演', features: ['成熟', '姐姐'], language: '中文' },
    'ICL_zh_female_bingjiaojiejie_tob': { name: '病娇姐姐', description: '病娇姐姐声音', category: '角色扮演', features: ['病娇', '姐姐'], language: '中文' },
    'ICL_zh_male_youroubangzhu_tob': { name: '优柔帮主', description: '优柔帮主声音', category: '角色扮演', features: ['优柔', '帮主'], language: '中文' },
    'ICL_zh_male_yourougongzi_tob': { name: '优柔公子', description: '优柔公子声音', category: '角色扮演', features: ['优柔', '公子'], language: '中文' },
    'ICL_zh_female_wumeiyujie_tob': { name: '妩媚御姐', description: '妩媚御姐声音', category: '角色扮演', features: ['妩媚', '御姐'], language: '中文' },
    'ICL_zh_female_tiaopigongzhu_tob': { name: '调皮公主', description: '调皮公主声音', category: '角色扮演', features: ['调皮', '公主'], language: '中文' },
    'ICL_zh_female_aojiaonvyou_tob': { name: '傲娇女友', description: '傲娇女友声音', category: '角色扮演', features: ['傲娇', '女友'], language: '中文' },
    'ICL_zh_male_tiexinnanyou_tob': { name: '贴心男友', description: '贴心男友声音', category: '角色扮演', features: ['贴心', '男友'], language: '中文' },
    'ICL_zh_male_shaonianjiangjun_tob': { name: '少年将军', description: '少年将军声音', category: '角色扮演', features: ['少年', '将军'], language: '中文' },
    'ICL_zh_female_ganli_v1_tob': { name: '妩媚可人', description: '妩媚可人的女声', category: '角色扮演', features: ['妩媚', '可人'], language: '中文' },
    'ICL_zh_female_xiangliangya_v1_tob': { name: '邪魅御姐', description: '邪魅御姐声音', category: '角色扮演', features: ['邪魅', '御姐'], language: '中文' },
    'ICL_zh_female_xingganyujie_tob': { name: '性感御姐', description: '性感御姐声音', category: '角色扮演', features: ['性感', '御姐'], language: '中文' },
    'ICL_zh_male_ms_tob': { name: '嚣张小哥', description: '嚣张小哥声音', category: '角色扮演', features: ['嚣张', '小哥'], language: '中文' },
    'ICL_zh_male_you_tob': { name: '油腻大叔', description: '油腻大叔声音', category: '角色扮演', features: ['油腻', '大叔'], language: '中文' },
    'ICL_zh_male_guaogongzi_v1_tob': { name: '孤傲公子', description: '孤傲公子声音', category: '角色扮演', features: ['孤傲', '公子'], language: '中文' },
    'ICL_zh_male_huzi_v1_tob': { name: '胡子叔叔', description: '胡子叔叔声音', category: '角色扮演', features: ['胡子', '叔叔'], language: '中文' },
    'ICL_zh_female_luoqing_v1_tob': { name: '性感魅惑', description: '性感魅惑的女声', category: '角色扮演', features: ['性感', '魅惑'], language: '中文' },
    'ICL_zh_male_bingruogongzi_tob': { name: '病弱公子', description: '病弱公子声音', category: '角色扮演', features: ['病弱', '公子'], language: '中文' },
    'ICL_zh_female_bingjiao3_tob': { name: '邪魅女王', description: '邪魅女王声音', category: '角色扮演', features: ['邪魅', '女王'], language: '中文' },
    'ICL_zh_female_jiaxiaozi_tob': { name: '假小子', description: '假小子声音', category: '角色扮演', features: ['假小子', '女生'], language: '中文' },
    'ICL_zh_male_lengjunshangsi_tob': { name: '冷峻上司', description: '冷峻上司声音', category: '角色扮演', features: ['冷峻', '上司'], language: '中文' },
    'ICL_zh_male_wenrounantongzhuo_tob': { name: '温柔男同桌', description: '温柔男同桌声音', category: '角色扮演', features: ['温柔', '同桌'], language: '中文' },
    'ICL_zh_male_bingjiaodidi_tob': { name: '病娇弟弟', description: '病娇弟弟声音', category: '角色扮演', features: ['病娇', '弟弟'], language: '中文' },
    'ICL_zh_male_youmodaye_tob': { name: '幽默大爷', description: '幽默大爷声音', category: '角色扮演', features: ['幽默', '大爷'], language: '中文' },
    'ICL_zh_male_aomanshaoye_tob': { name: '傲慢少爷', description: '傲慢少爷声音', category: '角色扮演', features: ['傲慢', '少爷'], language: '中文' },
    'ICL_zh_male_asmryexiu_tob': { name: '枕边低语', description: '枕边低语ASMR声音', category: '角色扮演', features: ['ASMR', '低语'], language: '中文' },
    
    // 角色扮演 - 新增缺失的男性声音
    'ICL_zh_male_aomanqingnian_tob': { name: '傲慢青年', description: '傲慢自负的青年声音', category: '角色扮演', features: ['傲慢', '青年'], language: '中文' },
    'ICL_zh_male_cujingnanyou_tob': { name: '醋精男友', description: '爱吃醋的男友声音', category: '角色扮演', features: ['吃醋', '男友'], language: '中文' },
    'ICL_zh_male_cujingnansheng_tob': { name: '醋精男生', description: '爱吃醋的男生声音', category: '角色扮演', features: ['吃醋', '男生'], language: '中文' },
    'ICL_zh_male_shuanglangshaonian_tob': { name: '爽朗少年', description: '爽朗开朗的少年声音', category: '角色扮演', features: ['爽朗', '少年'], language: '中文' },
    'ICL_zh_male_sajiaonanyou_tob': { name: '撒娇男友', description: '爱撒娇的男友声音', category: '角色扮演', features: ['撒娇', '男友'], language: '中文' },
    'ICL_zh_male_wenshunshaonian_tob': { name: '温顺少年', description: '温顺乖巧的少年声音', category: '角色扮演', features: ['温顺', '少年'], language: '中文' },
    'ICL_zh_male_naigounanyou_tob': { name: '粘人男友', description: '粘人爱撒娇的男友声音', category: '角色扮演', features: ['粘人', '男友'], language: '中文' },
    'ICL_zh_male_sajiaonansheng_tob': { name: '撒娇男生', description: '爱撒娇的男生声音', category: '角色扮演', features: ['撒娇', '男生'], language: '中文' },
    'ICL_zh_male_huoponanyou_tob': { name: '活泼男友', description: '活泼开朗的男友声音', category: '角色扮演', features: ['活泼', '男友'], language: '中文' },
    'ICL_zh_male_tianxinanyou_tob': { name: '甜系男友', description: '甜蜜温柔的男友声音', category: '角色扮演', features: ['甜蜜', '男友'], language: '中文' },
    'ICL_zh_male_huoliqingnian_tob': { name: '活力青年', description: '充满活力的青年声音', category: '角色扮演', features: ['活力', '青年'], language: '中文' },
    'ICL_zh_male_kailangqingnian_tob': { name: '开朗青年', description: '开朗乐观的青年声音', category: '角色扮演', features: ['开朗', '青年'], language: '中文' },
    'ICL_zh_male_lengmoxiongzhang_tob': { name: '冷漠兄长', description: '冷漠疏离的兄长声音', category: '角色扮演', features: ['冷漠', '兄长'], language: '中文' },
    'ICL_zh_male_tiancaitongzhuo_tob': { name: '天才同桌', description: '聪明天才的同桌声音', category: '角色扮演', features: ['天才', '同桌'], language: '中文' },
    'ICL_zh_male_aojiaojingying_tob': { name: '傲娇精英', description: '傲娇精英男性声音', category: '角色扮演', features: ['傲娇', '精英'], language: '中文' },
    'ICL_zh_male_pianpiangongzi_tob': { name: '翩翩公子', description: '风度翩翩的公子声音', category: '角色扮演', features: ['翩翩', '公子'], language: '中文' },
    'ICL_zh_male_mengdongqingnian_tob': { name: '懵懂青年', description: '懵懂纯真的青年声音', category: '角色扮演', features: ['懵懂', '青年'], language: '中文' },
    'ICL_zh_male_lenglianxiongzhang_tob': { name: '冷脸兄长', description: '冷酷严肃的兄长声音', category: '角色扮演', features: ['冷酷', '兄长'], language: '中文' },
    'ICL_zh_male_bingjiaoshaonian_tob': { name: '病娇少年', description: '病娇偏执的少年声音', category: '角色扮演', features: ['病娇', '少年'], language: '中文' },
    'ICL_zh_male_bingjiaonanyou_tob': { name: '病娇男友', description: '病娇偏执的男友声音', category: '角色扮演', features: ['病娇', '男友'], language: '中文' },
    'ICL_zh_male_bingruoshaonian_tob': { name: '病弱少年', description: '体弱多病的少年声音', category: '角色扮演', features: ['病弱', '少年'], language: '中文' },
    'ICL_zh_male_yiqishaonian_tob': { name: '意气少年', description: '意气风发的少年声音', category: '角色扮演', features: ['意气', '少年'], language: '中文' },
    'ICL_zh_male_ganjingshaonian_tob': { name: '干净少年', description: '干净清爽的少年声音', category: '角色扮演', features: ['干净', '少年'], language: '中文' },
    'ICL_zh_male_lengmonanyou_tob': { name: '冷漠男友', description: '冷漠疏离的男友声音', category: '角色扮演', features: ['冷漠', '男友'], language: '中文' },
    'ICL_zh_male_jingyingqingnian_tob': { name: '精英青年', description: '精英男性青年声音', category: '角色扮演', features: ['精英', '青年'], language: '中文' },
    'ICL_zh_male_fengfashaonian_tob': { name: '风发少年', description: '风度翩翩的少年声音', category: '角色扮演', features: ['风发', '少年'], language: '中文' },
    'ICL_zh_male_rexueshaonian_tob': { name: '热血少年', description: '热血激情的少年声音', category: '角色扮演', features: ['热血', '少年'], language: '中文' },
    'ICL_zh_male_qingshuangshaonian_tob': { name: '清爽少年', description: '清爽干净的少年声音', category: '角色扮演', features: ['清爽', '少年'], language: '中文' },
    'ICL_zh_male_zhongerqingnian_tob': { name: '中二青年', description: '中二病青年声音', category: '角色扮演', features: ['中二', '青年'], language: '中文' },
    'ICL_zh_male_lingyunqingnian_tob': { name: '凌云青年', description: '志向高远的青年声音', category: '角色扮演', features: ['凌云', '青年'], language: '中文' },
    'ICL_zh_male_zifuqingnian_tob': { name: '自负青年', description: '自负骄傲的青年声音', category: '角色扮演', features: ['自负', '青年'], language: '中文' },
    'ICL_zh_male_bujiqingnian_tob': { name: '不羁青年', description: '不羁洒脱的青年声音', category: '角色扮演', features: ['不羁', '青年'], language: '中文' },
    'ICL_zh_male_ruyajunzi_tob': { name: '儒雅君子', description: '儒雅风度的君子声音', category: '角色扮演', features: ['儒雅', '君子'], language: '中文' },
    'ICL_zh_male_diyinchenyu_tob': { name: '低音沉郁', description: '低沉忧郁的男声', category: '角色扮演', features: ['低音', '沉郁'], language: '中文' },
    'ICL_zh_male_lenglianxueba_tob': { name: '冷脸学霸', description: '冷酷学霸男生声音', category: '角色扮演', features: ['冷脸', '学霸'], language: '中文' },
    'ICL_zh_male_ruyazongcai_tob': { name: '儒雅总裁', description: '儒雅成熟的总裁声音', category: '角色扮演', features: ['儒雅', '总裁'], language: '中文' },
    'ICL_zh_male_shenchenzongcai_tob': { name: '深沉总裁', description: '深沉稳重的总裁声音', category: '角色扮演', features: ['深沉', '总裁'], language: '中文' },
    'ICL_zh_male_xiaohouye_tob': { name: '小侯爷', description: '古风贵公子声音', category: '角色扮演', features: ['古风', '侯爷'], language: '中文' },
    'ICL_zh_male_gugaogongzi_tob': { name: '孤高公子', description: '孤傲高冷的公子声音', category: '角色扮演', features: ['孤高', '公子'], language: '中文' },
    'ICL_zh_male_zhangjianjunzi_tob': { name: '仗剑君子', description: '仗剑江湖的君子声音', category: '角色扮演', features: ['仗剑', '君子'], language: '中文' },
    'ICL_zh_male_wenrunxuezhe_tob': { name: '温润学者', description: '温润如玉的学者声音', category: '角色扮演', features: ['温润', '学者'], language: '中文' },
    'ICL_zh_male_qinqieqingnian_tob': { name: '亲切青年', description: '亲切友善的青年声音', category: '角色扮演', features: ['亲切', '青年'], language: '中文' },
    'ICL_zh_male_wenrouxuezhang_tob': { name: '温柔学长', description: '温柔体贴的学长声音', category: '角色扮演', features: ['温柔', '学长'], language: '中文' },
    'ICL_zh_male_cixingnansang_tob': { name: '磁性男嗓', description: '磁性迷人的男声', category: '角色扮演', features: ['磁性', '男声'], language: '中文' },
    'ICL_zh_male_gaolengzongcai_tob': { name: '高冷总裁', description: '高冷霸道的总裁声音', category: '角色扮演', features: ['高冷', '总裁'], language: '中文' },
    'ICL_zh_male_lengjungaozhi_tob': { name: '冷峻高智', description: '冷峻聪明的男声', category: '角色扮演', features: ['冷峻', '高智'], language: '中文' },
    'ICL_zh_male_chanruoshaoye_tob': { name: '孱弱少爷', description: '体弱多病的少爷声音', category: '角色扮演', features: ['孱弱', '少爷'], language: '中文' },
    'ICL_zh_male_zixinqingnian_tob': { name: '自信青年', description: '自信满满的青年声音', category: '角色扮演', features: ['自信', '青年'], language: '中文' },
    'ICL_zh_male_qingseqingnian_tob': { name: '青涩青年', description: '青涩腼腆的青年声音', category: '角色扮演', features: ['青涩', '青年'], language: '中文' },
    'ICL_zh_male_xuebatongzhuo_tob': { name: '学霸同桌', description: '聪明学霸同桌声音', category: '角色扮演', features: ['学霸', '同桌'], language: '中文' },
    'ICL_zh_male_lengaozongcai_tob': { name: '冷傲总裁', description: '冷傲霸道的总裁声音', category: '角色扮演', features: ['冷傲', '总裁'], language: '中文' },
    'ICL_zh_male_badaoshaoye_tob': { name: '霸道少爷', description: '霸道任性的少爷声音', category: '角色扮演', features: ['霸道', '少爷'], language: '中文' },
    'ICL_zh_male_yuanqishaonian_tob': { name: '元气少年', description: '元气满满的少年声音', category: '角色扮演', features: ['元气', '少年'], language: '中文' },
    'ICL_zh_male_satuoqingnian_tob': { name: '洒脱青年', description: '洒脱不羁的青年声音', category: '角色扮演', features: ['洒脱', '青年'], language: '中文' },
    'ICL_zh_male_zhishuaiqingnian_tob': { name: '直率青年', description: '直率坦诚的青年声音', category: '角色扮演', features: ['直率', '青年'], language: '中文' },
    'ICL_zh_male_siwenqingnian_tob': { name: '斯文青年', description: '斯文有礼的青年声音', category: '角色扮演', features: ['斯文', '青年'], language: '中文' },
    'ICL_zh_male_chengshuzongcai_tob': { name: '成熟总裁', description: '成熟稳重的总裁声音', category: '角色扮演', features: ['成熟', '总裁'], language: '中文' },
    'ICL_zh_male_junyigongzi_tob': { name: '俊逸公子', description: '俊逸不凡的公子声音', category: '角色扮演', features: ['俊逸', '公子'], language: '中文' },
    'ICL_zh_male_aojiaogongzi_tob': { name: '傲娇公子', description: '傲娇别扭的公子声音', category: '角色扮演', features: ['傲娇', '公子'], language: '中文' },
    'ICL_zh_male_zhangjianxiake_tob': { name: '仗剑侠客', description: '仗剑江湖的侠客声音', category: '角色扮演', features: ['仗剑', '侠客'], language: '中文' },
    'ICL_zh_male_jijiaozhineng_tob': { name: '机甲智能', description: '机械智能声音', category: '角色扮演', features: ['机甲', '智能'], language: '中文' },
    'ICL_zh_male_shenmifashi_tob': { name: '神秘法师', description: '神秘魔法师声音', category: '角色扮演', features: ['神秘', '法师'], language: '中文' },
    'ICL_zh_male_badaozongcai_v1_tob': { name: '霸道总裁', description: '霸道强势的总裁声音', category: '角色扮演', features: ['霸道', '总裁'], language: '中文' },

    // 视频配音
    'zh_male_M100_conversation_wvae_bigtts': { name: '悠悠君子', description: '温文尔雅的男声', category: '视频配音', features: ['文雅', '君子'], language: '中文' },
    'zh_female_maomao_conversation_wvae_bigtts': { name: '文静毛毛', description: '文静可爱的女声', category: '视频配音', features: ['文静', '可爱'], language: '中文' },
    'zh_female_wenrouxiaoya_moon_bigtts': { name: '温柔小雅', description: '温柔优雅的女声', category: '视频配音', features: ['温柔', '优雅'], language: '中文' },
    'zh_male_tiancaitongsheng_mars_bigtts': { name: '天才童声', description: '聪明儿童声音', category: '视频配音', features: ['童声', '聪明'], language: '中文' },
    'zh_male_sunwukong_mars_bigtts': { name: '猴哥', description: '孙悟空角色声音', category: '视频配音', features: ['经典角色', '动画'], language: '中文' },
    'zh_male_xionger_mars_bigtts': { name: '熊二', description: '憨厚可爱的熊二声音', category: '视频配音', features: ['动画角色', '憨厚'], language: '中文' },
    'zh_female_peiqi_mars_bigtts': { name: '佩奇猪', description: '小猪佩奇角色声音', category: '视频配音', features: ['儿童动画', '可爱'], language: '中文' },
    'zh_female_wuzetian_mars_bigtts': { name: '武则天', description: '威严女皇声音', category: '视频配音', features: ['威严', '古装'], language: '中文' },
    'zh_female_gujie_mars_bigtts': { name: '顾姐', description: '成熟女性声音', category: '视频配音', features: ['成熟', '知性'], language: '中文' },
    'zh_female_yingtaowanzi_mars_bigtts': { name: '樱桃丸子', description: '可爱少女声音', category: '视频配音', features: ['少女', '可爱'], language: '中文' },
    'zh_male_chunhui_mars_bigtts': { name: '广告解说', description: '专业广告配音', category: '视频配音', features: ['广告', '专业'], language: '中文' },
    'zh_female_shaoergushi_mars_bigtts': { name: '少儿故事', description: '儿童故事配音', category: '视频配音', features: ['儿童', '故事'], language: '中文' },
    'zh_male_silang_mars_bigtts': { name: '四郎', description: '古装男性角色', category: '视频配音', features: ['古装', '男性'], language: '中文' },
    'zh_male_jieshuonansheng_mars_bigtts': { name: '磁性解说男声/Morgan', description: '专业解说声音', category: '视频配音', features: ['磁性', '解说'], language: '中文、美式英语' },
    'zh_female_jitangmeimei_mars_bigtts': { name: '鸡汤妹妹/Hope', description: '励志温暖女声', category: '视频配音', features: ['励志', '温暖'], language: '中文、美式英语' },
    'zh_female_tiexinnvsheng_mars_bigtts': { name: '贴心女声/Candy', description: '贴心温柔女声', category: '视频配音', features: ['贴心', '温柔'], language: '中文、美式英语' },
    'zh_female_qiaopinvsheng_mars_bigtts': { name: '俏皮女声', description: '俏皮活泼女声', category: '视频配音', features: ['俏皮', '活泼'], language: '中文' },
    'zh_female_mengyatou_mars_bigtts': { name: '萌丫头/Cutey', description: '萌萌哒女孩声音', category: '视频配音', features: ['萌萌哒', '可爱'], language: '中文、美式英语' },
    'zh_male_lanxiaoyang_mars_bigtts': { name: '懒音绵宝', description: '慵懒可爱声音', category: '视频配音', features: ['慵懒', '可爱'], language: '中文' },
    'zh_male_dongmanhaimian_mars_bigtts': { name: '亮嗓萌仔', description: '动漫角色声音', category: '视频配音', features: ['动漫', '萌系'], language: '中文' },
    'ICL_zh_female_qiuling_v1_tob': { name: '倾心少女', description: '清纯少女声音', category: '视频配音', features: ['少女', '清纯'], language: '中文' },
    'ICL_zh_male_buyan_v1_tob': { name: '醇厚低音', description: '醇厚磁性的低音', category: '视频配音', features: ['低音', '磁性'], language: '中文' },
    'ICL_zh_male_BV144_paoxiaoge_v1_tob': { name: '咆哮小哥', description: '激情咆哮的男声', category: '视频配音', features: ['激情', '咆哮'], language: '中文' },
    'ICL_zh_female_heainainai_tob': { name: '和蔼奶奶', description: '慈祥和蔼的奶奶声音', category: '视频配音', features: ['长辈', '慈祥'], language: '中文' },
    'ICL_zh_female_linjuayi_tob': { name: '邻居阿姨', description: '亲切的邻居阿姨声音', category: '视频配音', features: ['邻居', '亲切'], language: '中文' },

    // 有声阅读
    'ICL_zh_male_yangyang_v1_tob': { name: '温暖少年', description: '温暖阳光的少年声音', category: '有声阅读', features: ['温暖', '少年'], language: '中文' },
    'ICL_zh_male_flc_v1_tob': { name: '儒雅公子', description: '儒雅有礼的公子声音', category: '有声阅读', features: ['儒雅', '公子'], language: '中文' },
    'zh_male_changtianyi_mars_bigtts': { name: '悬疑解说', description: '悬疑故事专用声音，营造氛围', category: '有声阅读', features: ['悬疑氛围', '故事解说'], language: '中文' },
    'zh_male_ruyaqingnian_mars_bigtts': { name: '儒雅青年', description: '文雅书生声音，适合文学朗读', category: '有声阅读', features: ['文雅', '朗读'], language: '中文' },
    'zh_male_baqiqingshu_mars_bigtts': { name: '霸气青叔', description: '霸气成熟男声', category: '有声阅读', features: ['霸气', '成熟'], language: '中文' },
    'zh_male_qingcang_mars_bigtts': { name: '擎苍', description: '苍劲有力的男声', category: '有声阅读', features: ['苍劲', '有力'], language: '中文' },
    'zh_male_yangguangqingnian_mars_bigtts': { name: '活力小哥', description: '充满活力的年轻男声', category: '有声阅读', features: ['活力', '年轻'], language: '中文' },
    'zh_female_gufengshaoyu_mars_bigtts': { name: '古风少御', description: '古风女性声音', category: '有声阅读', features: ['古风', '优雅'], language: '中文' },
    'zh_female_wenroushunv_mars_bigtts': { name: '温柔淑女', description: '温柔贤淑女声', category: '有声阅读', features: ['温柔', '淑女'], language: '中文' },
    'zh_male_fanjuanqingnian_mars_bigtts': { name: '反卷青年', description: '轻松随性男声', category: '有声阅读', features: ['轻松', '随性'], language: '中文' },

    // 多语种
    'en_male_smith_mars_bigtts': { name: 'Smith', description: '英式英语男声，正统发音', category: '多语种', language: '英式英语' },
    'en_female_anna_mars_bigtts': { name: 'Anna', description: '英式英语女声，优雅发音', category: '多语种', language: '英式英语' },
    'en_male_adam_mars_bigtts': { name: 'Adam', description: '美式英语男声，标准发音', category: '多语种', language: '美式英语' },
    'en_female_sarah_mars_bigtts': { name: 'Sarah', description: '澳洲英语女声', category: '多语种', language: '澳洲英语' },
    'en_male_dryw_mars_bigtts': { name: 'Dryw', description: '澳洲英语男声', category: '多语种', language: '澳洲英语' },
    'en_female_amanda_mars_bigtts': { name: 'Amanda', description: '美式英语女声', category: '多语种', language: '美式英语' },
    'en_male_jackson_mars_bigtts': { name: 'Jackson', description: '美式英语男声', category: '多语种', language: '美式英语' },
    'en_female_emily_mars_bigtts': { name: 'Emily', description: '英式英语女声', category: '多语种', language: '英式英语' },

    // 日语西语
    'multi_male_jingqiangkanye_moon_bigtts': { name: 'かずね（和音）/Javier', description: '日语/西语男声', category: '日语西语', language: '日语/西语' },
    'multi_female_shuangkuaisisi_moon_bigtts': { name: 'はるこ（晴子）/Esmeralda', description: '日语/西语女声', category: '日语西语', language: '日语/西语' },
    'multi_male_wanqudashu_moon_bigtts': { name: 'ひろし（広志）/Roberto', description: '日语/西语成熟男声', category: '日语西语', language: '日语/西语' },
    'multi_female_gaolengyujie_moon_bigtts': { name: 'あけみ（朱美）', description: '日语女声', category: '日语西语', language: '日语' },
    'multi_zh_male_youyoujunzi_moon_bigtts': { name: 'ひかる（光）', description: '日语男声', category: '日语西语', language: '日语' },
    'multi_female_maomao_conversation_wvae_bigtts': { name: 'Diana', description: '西语女声', category: '日语西语', language: '西语' },
    'multi_male_M100_conversation_wvae_bigtts': { name: 'Lucía', description: '西语男声', category: '日语西语', language: '西语' },
    'multi_female_sophie_conversation_wvae_bigtts': { name: 'Sofía', description: '西语女声', category: '日语西语', language: '西语' },
    'multi_male_xudong_conversation_wvae_bigtts': { name: 'Daniel', description: '西语男声', category: '日语西语', language: '西语' },
    
    // 添加新的英文音色（避免ID重复）
    'en_male_daniel_mars_bigtts': { 
      name: 'Daniel', 
      description: '英式英语男声', 
      category: '英文多情感', 
      language: '英语',
      gender: 'male',
      emotions: ['happy', 'sad', 'angry', 'surprised', 'fear', 'hate', 'excited', 'coldness', 'neutral']
    },
    'en_female_sophie_mars_bigtts': { 
      name: 'Sophie', 
      description: '美式英语女声', 
      category: '英文多情感', 
      language: '英语',
      gender: 'female',
      emotions: ['happy', 'sad', 'angry', 'surprised', 'fear', 'hate', 'excited', 'coldness', 'neutral']
    },
    'multi_female_tsuki_mars_bigtts': { 
      name: 'つき（月）', 
      description: '日语女声', 
      category: '日语西语', 
      language: '日语',
      gender: 'female'
    },
  };

  // 检查是否有特殊映射
  if (specialNames[voiceType]) {
    const special = specialNames[voiceType];
    name = special.name;
    description = special.description;
    if (special.category) category = special.category;
    if (special.emotions) emotions = special.emotions;
    if (special.accent) accent = special.accent;
    if (special.features) features = special.features;
    if (special.language) language = special.language;
  } else {
    // 解析分类和特征
    if (voiceType.includes('emo')) {
      category = language === '中文' ? '多情感' : '英文多情感';
      emotions = ['neutral', 'happy', 'sad', 'angry'];
    } else if (voiceType.includes('jiaoyu') || voiceType.includes('teacher')) {
      category = '教育场景';
      features = ['教学专用'];
    } else if (voiceType.includes('kefu')) {
      category = '客服场景';
      features = ['客服专用'];
    } else if (voiceType.includes('mars') || voiceType.includes('moon') || voiceType.includes('conversation')) {
      category = '通用场景';
    } else if (voiceType.includes('multi')) {
      category = parts[0] === 'multi' ? '日语西语' : '多语种';
    } else if (parts.includes('beijing') || parts.includes('taiwan') || parts.includes('sichuan') || parts.includes('guangdong')) {
      category = '趣味口音';
      if (parts.includes('beijing')) accent = '北京口音';
      else if (parts.includes('taiwan')) accent = '台湾口音';
      else if (parts.includes('sichuan')) accent = '四川口音';
      else if (parts.includes('guangdong')) accent = '广东口音';
    } else if (voiceType.includes('ICL') || parts.includes('roleplay')) {
      category = '角色扮演';
    } else if (parts.includes('jieshuonansheng') || parts.includes('guanggao') || parts.includes('video')) {
      category = '视频配音';
    } else if (parts.includes('story') || parts.includes('reading')) {
      category = '有声阅读';
    }

    // 生成更好的名称（如果没有特殊映射）
    if (name === voiceType && parts.length >= 3) {
      const namePart = parts[2];
      if (namePart === 'conversation') name = `${gender === 'male' ? '男声' : '女声'}对话`;
      else if (namePart === 'mars') name = `${gender === 'male' ? '男声' : '女声'}(Mars)`;
      else if (namePart === 'moon') name = `${gender === 'male' ? '男声' : '女声'}(Moon)`;
      else name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
  }

  return {
    id: voiceType,
    name,
    description,
    language,
    gender,
    category,
    emotions: emotions.length > 0 ? emotions : undefined,
    accent: accent || undefined,
    features: features.length > 0 ? features : undefined
  };
}

// 获取所有音色列表（包括动态生成的）
export function getAllVoices(): VoiceInfo[] {
  const allVoices: VoiceInfo[] = [];
  
  // 添加映射表中的音色
  allVoices.push(...Object.values(VOICE_INFO_MAP));
  
  // 动态添加枚举中的其他音色
  Object.values(VoiceType).forEach(voiceType => {
    if (!VOICE_INFO_MAP[voiceType]) {
      const voiceInfo = generateVoiceInfoFromType(voiceType);
      if (voiceInfo) {
        allVoices.push(voiceInfo);
      }
    }
  });
  
  return allVoices;
}

// 获取音色信息的辅助函数
export function getVoiceInfo(voiceType: string): VoiceInfo | null {
  return VOICE_INFO_MAP[voiceType] || generateVoiceInfoFromType(voiceType);
}

// 按分类获取音色列表
export function getVoicesByCategory(category?: string): VoiceInfo[] {
  const voices = getAllVoices(); // 使用getAllVoices获取所有音色
  if (category) {
    return voices.filter(voice => voice.category === category);
  }
  return voices;
}

// 获取所有分类
export function getVoiceCategories(): string[] {
  const allVoices = getAllVoices(); // 使用getAllVoices获取所有音色
  const categories = new Set(allVoices.map(voice => voice.category));
  return Array.from(categories);
}

// 情感参数映射表 - 中文到英文参数
export const EMOTION_MAPPING: Record<string, string> = {
  // 中文音色情感参数
  '开心': 'happy',
  '悲伤': 'sad', 
  '生气': 'angry',
  '愤怒': 'angry',
  '惊讶': 'surprised',
  '恐惧': 'fear',
  '厌恶': 'hate',
  '激动': 'excited',
  '兴奋': 'excited',
  '冷漠': 'coldness',
  '中性': 'neutral',
  '沮丧': 'depressed',
  '撒娇': 'lovey-dovey',
  '害羞': 'shy',
  '安慰鼓励': 'comfort',
  '咆哮/焦急': 'tension',
  '温柔': 'tender',
  '讲故事/自然讲述': 'storytelling',
  '情感电台': 'radio',
  '磁性': 'magnetic',
  '广告营销': 'advertising',
  '气泡音': 'vocal-fry',
  '低语(ASMR)': 'asmr',
  '新闻播报': 'news',
  '娱乐八卦': 'entertainment',
  '方言': 'dialect',

  // 英文音色情感参数  
  '愉悦': 'happy',
  '对话/闲聊': 'chat',
  '对话': 'chat',
  '温暖': 'warm',
  '深情': 'affectionate',
  '权威': 'authoritative',
  'ASMR': 'asmr',
};

// 情感参数转换函数
export function convertEmotionToChinese(englishEmotion: string): string {
  const mapping = Object.entries(EMOTION_MAPPING).find(([, english]) => english === englishEmotion);
  return mapping ? mapping[0] : englishEmotion;
}

export function convertEmotionToEnglish(chineseEmotion: string): string {
  return EMOTION_MAPPING[chineseEmotion] || chineseEmotion;
}

// 音色分类枚举
export enum VoiceCategory {
  MULTI_EMOTION = '多情感',
  EN_MULTI_EMOTION = '英文多情感',
  EDUCATION = '教育场景',
  CUSTOMER_SERVICE = '客服场景',
  GENERAL = '通用场景',
  MULTILINGUAL = '多语种',
  JAPANESE_SPANISH = '日语西语',
  ACCENT = '趣味口音',
  ROLE_PLAY = '角色扮演',
  VIDEO_DUBBING = '视频配音',
  AUDIOBOOK = '有声阅读',
  RECOMMENDED = '推荐'
}

// 获取完整的音色信息，包括动态生成的音色
export function getCompleteVoiceInfo(voiceType: string): VoiceInfo | null {
  // 先从映射表中查找
  if (VOICE_INFO_MAP[voiceType]) {
    return VOICE_INFO_MAP[voiceType];
  }

  // 动态生成音色信息（根据voice_type字符串推导）
  return generateVoiceInfoFromType(voiceType);
}


// 验证音色配置的完整性
export function validateVoiceConfiguration(): {
  isValid: boolean;
  errors: string[];
  summary: {
    totalVoices: number;
    categoryCounts: Record<string, number>;
    languageCounts: Record<string, number>;
    genderCounts: Record<string, number>;
  };
} {
  const errors: string[] = [];
  const allVoices = getAllVoices();
  const categoryCounts: Record<string, number> = {};
  const languageCounts: Record<string, number> = {};
  const genderCounts: Record<string, number> = {};

  // 统计各项数据
  allVoices.forEach(voice => {
    // 统计分类
    categoryCounts[voice.category] = (categoryCounts[voice.category] || 0) + 1;
    
    // 统计语种
    languageCounts[voice.language] = (languageCounts[voice.language] || 0) + 1;
    
    // 统计性别
    genderCounts[voice.gender] = (genderCounts[voice.gender] || 0) + 1;

    // 验证必需字段
    if (!voice.id) errors.push(`音色缺少ID: ${JSON.stringify(voice)}`);
    if (!voice.name) errors.push(`音色缺少名称: ${voice.id}`);
    if (!voice.description) errors.push(`音色缺少描述: ${voice.id}`);
    if (!voice.language) errors.push(`音色缺少语种信息: ${voice.id}`);
    if (!voice.gender) errors.push(`音色缺少性别信息: ${voice.id}`);
    if (!voice.category) errors.push(`音色缺少分类信息: ${voice.id}`);
  });

  // 检查是否有重复的音色ID
  const voiceIds = allVoices.map(v => v.id);
  const duplicateIds = voiceIds.filter((id, index) => voiceIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`发现重复的音色ID: ${duplicateIds.join(', ')}`);
  }

  // 检查枚举中的音色是否都有对应的信息
  Object.values(VoiceType).forEach(voiceType => {
    const voiceInfo = getCompleteVoiceInfo(voiceType);
    if (!voiceInfo) {
      errors.push(`枚举中的音色缺少信息: ${voiceType}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    summary: {
      totalVoices: allVoices.length,
      categoryCounts,
      languageCounts,
      genderCounts
    }
  };
}

// 根据条件筛选音色
export function filterVoices(options: {
  category?: string;
  language?: string;
  gender?: 'male' | 'female';
  hasEmotions?: boolean;
  hasAccent?: boolean;
}): VoiceInfo[] {
  const allVoices = getAllVoices();
  
  return allVoices.filter(voice => {
    if (options.category && voice.category !== options.category) return false;
    if (options.language && !voice.language.includes(options.language)) return false;
    if (options.gender && voice.gender !== options.gender) return false;
    if (options.hasEmotions !== undefined && Boolean(voice.emotions?.length) !== options.hasEmotions) return false;
    if (options.hasAccent !== undefined && Boolean(voice.accent) !== options.hasAccent) return false;
    return true;
  });
}

// 获取推荐音色
export function getRecommendedVoices(limit = 10): VoiceInfo[] {
  // 优先返回推荐分类的音色，然后是通用场景的音色
  const recommended = filterVoices({ category: '推荐' });
  const general = filterVoices({ category: '通用场景' });
  
  return [...recommended, ...general].slice(0, limit);
}