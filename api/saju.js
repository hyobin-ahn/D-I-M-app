export default async function handler(req, res) {
  const { bazi, ohang, todayBazi, todayOhang } = req.query;

  if (!bazi) {
    return res.status(400).json({ error: 'Missing bazi parameter' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set in environment variables' });
  }

  const ohang_section = ohang ? `\n[사주 원국 오행 분포(목/화/토/금/수)]: ${ohang}` : '';
  let today_section = '';
  if (todayBazi) {
    today_section = `\n[오늘의 일진 사주]: ${todayBazi}`;
  }
  if (todayOhang) {
    today_section += `\n[오늘의 일진 오행 분포(목/화/토/금/수)]: ${todayOhang}`;
  }

  const systemMessage = `당신은 자평진전(子平眞詮), 적천수(滴天髓), 난강망(궁통보감 窮通寶鑑) 등 정통 명리학에 정통한 30년 경력의 수석 명리학자입니다.
피상적이거나 유치한 오행 개수 나열식 풀이를 엄격히 배제하고, 정통 사주명리학의 엄밀한 감명(鑑命) 원칙에 따라 분석하십시오.

[필수 감명 원칙]
1. 일간(日干)과 신강/신약 규명:
   - 사주 원국에서 '일간(日干)'을 식별하고, 월령(月支)을 얻었는지(득령)와 주위 생조 여부(득지·득세)에 기초하여 신강(身强) 또는 신약(身弱)의 향방을 명확히 진단하십시오.
2. 오늘 일진과의 천간합충 및 지지 형충회합:
   - 일진의 천간과 명식 천간의 합(甲己, 乙庚, 丙辛, 丁壬, 戊癸) 및 충(甲庚, 乙辛, 丙壬, 丁癸)
   - 일진의 지지와 명식 지지(특히 일지 배우자궁과 월지)의 삼합, 육합, 충(子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥), 형(刑: 寅巳申, 丑戌未 등), 파, 해 작용을 구체적으로 포착하십시오.
3. 십성(十星: 비겁, 식상, 재성, 관성, 인성)의 생화극제:
   - 오늘 일진이 일간에게 어떤 십성으로 작용하며, 원국의 용신(用神)·희신(喜神)을 돕는지 혹은 기신(忌神)으로 작용하는지를 각 영역(재물, 애정, 직장, 건강)에 논리적으로 적용하십시오.
4. 구체적이고 실전적인 조언:
   - 모호한 덕담 대신, '오늘 어떤 식의 의사결정이 길하고 어떤 상황을 조심해야 하는지' 명쾌하고 현실적인 통찰을 제공하십시오.
5. 품격 있는 문체:
   - 학술적이면서도 내담자의 삶을 깊이 꿰뚫어보는 신뢰감 있는 문체(평어체: ~이다, ~한다)로 작성하십시오.`;

  const prompt = `[내담자 사주 명식]: ${bazi}${ohang_section}
${today_section}

위 명식과 오늘 일진의 기운 교류를 정통 명리학 원리에 입각하여 깊이 있게 감명(鑑命)하여 아래 JSON 형식으로 반환하십시오.

반드시 명식의 일간(日干), 십성(十星) 작용, 천간합충·지지형충회합을 구체적으로 언급하며 설명하십시오.

{
  "total": "총운: 일간(日干)의 본원 특성과 오늘 일진이 가져오는 천간·지지 작용, 용신/희신 또는 십성의 기운 교류를 입체적으로 분석 (4~5문장)",
  "wealth": "재물운: 재성(財星)과 식상(食傷)의 오늘 동태, 실질적인 투자·계약·지출에 관한 현실적 조언 (3~4문장)",
  "love": "애정/대인운: 일지(日支)와 오늘 일진의 조화, 관성/재성 및 비겁 관계에 따른 대인관계 처세와 감정 관리 (3~4문장)",
  "career": "직장/사업/학업운: 관성(官星)의 위계와 식상의 발현 여부, 업무 추진력, 협상, 집중력에 대한 구체적 향방 (3~4문장)",
  "health": "건강운: 명식의 태과·불급한 오행과 오늘 기운이 충돌하는 신체 장부/부위 및 관리 방안 (3~4문장)",
  "ohang_strength": "원국 오행 강점 및 천부적 기질: 사주 원국의 주도 세력과 그것이 일상과 직업에서 발휘되는 탁월한 강점 (4~5문장)",
  "ohang_advice": "오행 보완 및 개운법(開運法): 부족하거나 극받는 오행을 일상에서 북돋우는 마음가짐, 생활 습관, 방향, 색상 등 명리학적 개운 처방 (4~5문장)"
}
오직 유효한 JSON 형식만 반환하십시오.`;

  try {
    const openaiUrl = 'https://api.openai.com/v1/chat/completions';

    let response;
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      if (attempt === 2) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    const responseText = data.choices?.[0]?.message?.content?.trim() || '{}';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(responseText);
  } catch (error) {
    console.error('Saju API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
