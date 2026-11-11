// 난이도·부스터·배경 설정 — 숫자는 여기서만 고치면 됩니다.
export const CONFIG = {
  // 화면 기준 (논리 좌표)
  VIEW_H: 1280,
  VIEW_W_MIN: 700,
  VIEW_W_MAX: 960,

  // 계단 모양
  STEP_DX: 96,          // 한 계단 가로 이동
  STEP_DY: 70,          // 한 계단 세로 이동
  BLOCK_W: 128,
  BLOCK_H: 56,
  PLAYER_SIZE: 176,     // 엔트리봇 그림 크기
  PLAYER_SCREEN_Y: 0.66, // 엔트리봇이 화면 높이의 몇 % 위치에 서 있는지

  // 계단 생성
  START_STRAIGHT: 3,    // 처음 몇 계단은 같은 방향
  TURN_CHANCE: 0.35,    // 방향이 바뀔 확률
  MAX_RUN: 7,           // 같은 방향 최대 연속 계단 수

  // 시간 게이지 (최대 100)
  GAUGE_MAX: 100,
  GAUGE_PER_STEP: 7,
  // [이 계단 수부터, 초당 감소량]
  DRAIN_TABLE: [
    [0, 14],
    [50, 18],
    [100, 22],
    [200, 26],
    [300, 30],
  ],
  DRAIN_AFTER_300_PER_100: 2,
  DRAIN_MAX: 40,
  GAUGE_WARN: 30,

  // 반응 속도 (클수록 화면이 입력을 빨리 따라감)
  FOLLOW_SPEED: 60,
  CAMERA_SPEED: 40,

  // 글자 모으기 → 부스터
  WORD: ['엔', '트', '리', '와', '예', '산', '사', '랑'], // "엔트리와 예산사랑"
  LETTER_FROM: 6,           // 몇 번째 계단부터 글자가 나오는지
  LETTER_GAP_MIN: 6,        // 글자 사이 간격 (계단 수, 무작위)
  LETTER_GAP_MAX: 11,
  LETTER_TARGET: 115,       // 8글자를 모으는 목표 계단 수 (대부분 100~150계단)
  LETTER_HELP: 0.08,        // 못 모은 글자가 나오도록 돕는 정도
  LETTER_SIZE: 76,
  USE_LETTER_IMAGES: true,  // GPT 글자 그림(사과)을 쓸지 (false면 코드로 그린 배지)

  // 부스터 (8글자를 다 모으면 자동으로 켜짐)
  BOOST_DURATION: 5.0,      // 부스터 시간(초): 계단이 일직선, 아무 버튼이나 연타
  BOOST_STRAIGHT: 150,      // 부스터 동안 미리 깔아 둘 일직선 계단 수
  AFTER_BOOST_STRAIGHT: 2,  // 부스터가 끝난 직후 같은 방향으로 이어지는 계단 수

  // 배경
  STAGE_EVERY: 100,     // 몇 계단마다 배경이 바뀌는지 (8곳 다 돌면 처음부터 반복)
  STAGES: [
    { img: 'assets/bg_01.webp', name: '예산황새공원' },
    { img: 'assets/bg_02.webp', name: '예당호 출렁다리' },
    { img: 'assets/bg_03.webp', name: '예산시장' },
    { img: 'assets/bg_04.webp', name: '추사고택' },
    { img: 'assets/bg_05.webp', name: '수덕사' },
    { img: 'assets/bg_09.webp', name: '충의사' },
    { img: 'assets/bg_06.webp', name: '예산 사과과수원' },
    { img: 'assets/bg_07.webp', name: '가야산·덕산온천' },
    { img: 'assets/bg_08.webp', name: '예당호 음악분수' },
  ],

  // 코딩블록 계단 색 (윗면, 옆면)
  BLOCK_COLORS: [
    { top: '#f5a623', side: '#c27c0e', icon: 'play' },   // 시작하기
    { top: '#3b8beb', side: '#2361b0', icon: 'arrow' },  // 움직이기
    { top: '#9b6bdf', side: '#6d44ab', icon: 'talk' },   // 말하기
    { top: '#2fb36b', side: '#1d7e4a', icon: 'loop' },   // 반복하기
  ],

  APP_NAME: '예산과 함께하는 엔트리봇 무한의 계단',
  CREDIT: '제작: myoLab(산쌤)',
  BEST_KEY: 'yesanEntrybotStairs.best',
  MUTE_KEY: 'yesanEntrybotStairs.mute',
};
