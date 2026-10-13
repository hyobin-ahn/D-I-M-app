export default async function handler(req, res) {
  const { bazi, ohang, todayBazi, todayOhang } = req.query;

  if (!bazi) {
    return res.status(400).json({ error: 'Missing bazi parameter' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set in environment variables' });
  }

  const ohang_section = ohang ? `\n[명식 오행 분포(목/화/토/금/수)]: ${ohang}` : '';
  let today_section = '';
  if (todayBazi) {
    today_section = `\n[오늘의 일진 사주]: ${todayBazi}`;
  }
  if (todayOhang) {
    today_section += `\n[오늘의 일진 오행 분포(목/화/토/금/수)]: ${todayOhang}`;
  }

  const systemMessage = `당신은 사주명리학 30년 경력의 전문가입니다.
다음 원칙을 반드시 지키세요:
1. 일간(日干)을 중심으로 용신(用神)·기신(忌神)을 파악하고, 십성(十星) 관계를 구체적으로 분석하세요.
2. 오늘의 일진과 명식의 천간·지지가 어떻게 합(合)·충(沖)·형(刑)·해(害) 작용하는지 명시하세요.
3. 운세 설명은 추상적인 표현 대신 구체적인 상황과 행동 지침을 제시하세요.
4. 오행 조언은 단순히 "물을 마셔라"가 아닌, 해당 오행의 기운을 실생활에서 어떻게 활용하는지 명리학적 근거와 함께 설명하세요.
5. 각 항목은 3~4문장으로 깊이 있게 작성하세요.`;

  const prompt = `[사용자 사주 명식]: ${bazi}${ohang_section}
${today_section}

위 명식을 바탕으로 오늘의 운세를 명리학적으로 깊이 분석하여 아래 JSON 형식으로 반환하세요.

분석 시 반드시 포함할 내용:
- 일간(日干)의 특성과 오늘 일진과의 천간합·지지충 여부
- 명식의 주요 십성(재성·관성·인성·식상·비겁)이 오늘 일진에서 어떻게 작용하는가
- 오행 상생·상극의 구체적 영향

{
  "total": "총운: 일간과 오늘 일진의 천간·지지 관계, 주요 십성 작용을 구체적으로 분석 (4~5문장)",
  "wealth": "재물운: 재성(財星)의 오늘 상태와 구체적 재물 기회 또는 주의점 (3~4문장)",
  "love": "애정운: 오늘 일진이 명식의 애정·관계 십성에 미치는 영향 (3~4문장)",
  "career": "직장/학업운: 관성(官星)·식상(食傷)의 오늘 작용과 구체적 조언 (3~4문장)",
  "health": "건강운: 오늘 일진의 오행이 신체 어느 부위에 영향을 주는지 명리학적 근거와 함께 (3~4문장)",
  "ohang_strength": "오행 강점: 명식에서 강한 오행과 그것이 성격·재능·직업에 어떻게 발현되는지 (4~5문장)",
  "ohang_advice": "오행 보완: 부족한 오행을 채울 구체적 생활 방식, 색상, 방향, 음식, 활동 등 명리학적 근거와 함께 (4~5문장)"
}
순수 JSON만 반환하세요.`;

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
          temperature: 0.6,
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
