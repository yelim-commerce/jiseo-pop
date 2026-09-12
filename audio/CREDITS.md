# 음원 출처 및 라이선스

## bumblebee.mp3

- **곡**: 〈왕벌의 비행 (Flight of the Bumblebee)〉
- **작곡**: 니콜라이 림스키코르사코프 (Nikolai Rimsky-Korsakov), 1899–1900년
  오페라 〈술탄 황제의 이야기〉 중. **작곡 자체는 퍼블릭 도메인**입니다.
- **연주**: United States Air Force Band of the Rockies, Concert Band
- **저작권**: 미국 연방정부 소속 기관의 공무상 저작물 → **퍼블릭 도메인 (Public Domain)**
- **출처**: Wikimedia Commons
  https://commons.wikimedia.org/wiki/File:Flight_of_the_Bumblebee_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3
- **원본 파일**: MP3 / 128 kbps / 44.1 kHz / 스테레오 / 83.93초 / 1.45 MB
- **가공**: 없음 (원본 그대로). 게임에서는 재생 시작점만 1.42초로 지정해
  도입부 무음(약 1.45초)을 건너뜁니다.

### 측정한 템포

게임의 풍선 낙하가 이 값에 맞춰져 있습니다.

- 온셋 자기상관(onset autocorrelation) 분석으로 측정
- **♩ = 169.5 BPM** (4분음표 주기 0.354초), 16분음표 **초당 11.3개**
- 실연주라 구간별 미세한 템포 변화가 있으나(±3% 내외), 30초 플레이에서는
  체감되지 않는 수준입니다.

### 교체하려면

`game.js` 상단 `AUDIO` 객체를 수정하세요.

```js
const AUDIO = {
  src: 'audio/bumblebee.mp3',
  bpm: 169.5,        // 새 음원의 실제 템포로 반드시 바꿀 것
  startAt: 1.42,     // 도입부 무음 길이(초)
  volume: 0.5
};
```

`bpm`을 실제 템포와 맞추지 않으면 풍선 낙하가 음악과 어긋납니다.
파일을 지우거나 경로가 틀리면 게임은 자동으로 내장 합성 시퀀서로 폴백합니다.

> 상업 공간(매장·부스)에서 사용할 때: 이 녹음은 퍼블릭 도메인이라 음원 사용료는
> 없습니다. 다만 국내 매장 내 음악 재생에 대한 공연권 관련 규정은 별도로
> 확인하시기 바랍니다.
