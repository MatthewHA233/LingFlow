-- 创建旧用户表
CREATE TABLE IF NOT EXISTS old_auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    has_registered BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入现有的旧用户邮箱数据
INSERT INTO old_auth_users (email) VALUES
('1786194243@qq.com'),
('zgxtayn@126.com'),
('1528919811@qq.com'),
('2088442894@qq.com'),
('rgqiudx@163.com'),
('lmclxl@163.com'),
('3854911352@qq.com'),
('1073836359@qq.com'),
('1764497124@qq.com'),
('664405178@qq.com'),
('2413465177@qq.com'),
('long.zhouendy@gmail.com'),
('401454460@qq.com'),
('3410785811@qq.com'),
('zirui0504@gmail.com'),
('3526760025@qq.com'),
('3840227649@qq.com'),
('3987740938@qq.com'),
('3164964597@qq.com'),
('250441256@qq.com'),
('3254841901@qq.com'),
('3345497757@qq.com'),
('xxbarca@163.com'),
('2088701794@qq.com'),
('1051542214@qq.com'),
('2456679615@qq.com'),
('lwlwl163@163.com'),
('246672774@qq.com'),
('1055221134@qq.com'),
('2807974622@qq.com'),
('326831165@qq.com'),
('zhang_qingqiu@outlook.com'),
('mazixu20211966@outlook.com'),
('3616789115@qq.com'),
('sevenseek@163.com'),
('15539944@qq.com'),
('hjwks1314@163.com'),
('3084686580@qq.com'),
('3581612475@qq.com'),
('992193089@qq.com'),
('2123356921@qq.com'),
('2722202788@qq.com'),
('2371748880@qq.com'),
('3776931930@qq.com'),
('2921744807@qq.com'),
('ame_thyst@126.com'),
('593094131@qq.com'),
('3057294870@qq.com'),
('18036374992@163.com'),
('1877180029@qq.com'),
('793788915@qq.com'),
('sxzdwxzz@qq.com'),
('1798479769@qq.com'),
('lxkwlyx@163.com'),
('zambast@163.com'),
('2091987860@qq.com'),
('2671147742@qq.com'),
('1208149239@qq.com'),
('matthewha233@gmail.com'),
('15060909017@163.com'),
('xy8776895@163.com'),
('742439320@qq.com'),
('358281436@qq.com'),
('1324253917@qq.com'),
('suawqt739@qq.com'),
('846957664@qq.com'),
('1123wesfhnh@163.com'),
('qq@12345.com'),
('583672402@qq.com'),
('3242308972@qq.com'),
('ailookbook@outlook.com'),
('960199445@qq.com'),
('su137705034@gmail.com'),
('965625780@qq.com'),
('947790973@qq.com'),
('xiayijcc@126.com'),
('505808326@qq.com'),
('1293600833@qq.com'),
('1064420570@qq.com'),
('1289545863@qq.com'),
('2232346858@qq.com'),
('ffsir@qq.com'),
('1542433942@qq.com'),
('tepit60601@lukasore.com'),
('1853787461@qq.com'),
('shi6ye@yeah.net'),
('netregone@protonmail.com'),
('1835383023@qq.com'),
('3394009106@qq.com'),
('1960529096@qq.com'),
('55474253kam@gmail.com'),
('3172756937@qq.com'),
('life_goods@163.com'),
('sxzdwxzz@163.com'),
('2778910072@qq.com'),
('wudixia1111@163.com'),
('2250363496@qq.com'),
('3104812079@qq.com'),
('renzhengjia2006@126.com'),
('1138658084@qq.com'),
('676692646@qq.com'),
('1490226031@qq.com'),
('339963667@qq.com'),
('1539377877@qq.com'),
('2959798406@qq.com'),
('892775910@qq.com'),
('caowanqian@qq.com'),
('studyengir@hotmail.com'),
('2549801107@qq.com'),
('echoiii.00@gmail.com'),
('wangguitong07@gmail.com'),
('2909217558@qq.com'),
('1669759653@qq.com'),
('3298073614@qq.com'),
('2153560030@qq.com'),
('15683865530@163.com'),
('15634869526@163.com'),
('liruixi.4869@outlook.com'),
('zjg13680502991@126.com'),
('483428538@qq.com'),
('2462232386@qq.com'),
('1805628779@qq.com'),
('lqx22566@outlook.com'),
('3033531960@qq.com'),
('enjoywords@qq.com'),
('2243725197@qq.com'),
('wuxia233-404@qq.com'),
('3216254828@qq.com'),
('su1377059034@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_old_auth_users_email ON old_auth_users(email);
CREATE INDEX IF NOT EXISTS idx_old_auth_users_has_registered ON old_auth_users(has_registered);

-- 创建触发器函数来自动更新 updated_at
CREATE OR REPLACE FUNCTION update_old_auth_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_update_old_auth_users_updated_at
    BEFORE UPDATE ON old_auth_users
    FOR EACH ROW
    EXECUTE FUNCTION update_old_auth_users_updated_at();

-- 启用行级安全策略 (RLS)
ALTER TABLE old_auth_users ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有用户（包括匿名用户）读取旧用户信息
CREATE POLICY "Allow all users to read old_auth_users" ON old_auth_users
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 创建策略：只允许认证用户更新
CREATE POLICY "Allow authenticated users to update old_auth_users" ON old_auth_users
    FOR UPDATE
    TO authenticated
    USING (true);

-- 创建策略：允许服务角色进行所有操作
CREATE POLICY "Allow service role full access" ON old_auth_users
    FOR ALL
    TO service_role
    USING (true); 