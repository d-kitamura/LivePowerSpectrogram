# Live spectrogram / リアルタイム・スペクトログラム表示アプリ

## 概要

**Live spectrogram** は，ブラウザ上で動作するリアルタイム音声解析アプリです。
PCのマイク入力を使って，入力音声の時間波形と，パワーまたは位相のスペクトログラムをリアルタイムに表示できます。

音の大きさ，周波数成分，時間変化を視覚的に確認できるため，音響信号処理，音響工学，音声・音楽信号解析の教育デモに利用できます。
特に，音の高さと周波数の関係，母音や楽器音のスペクトル構造，時間周波数解析，FFT，窓関数，スペクトログラムの理解に役立ちます。

HTML，CSS，JavaScriptのみで構成されており，インストール不要でブラウザから利用できます。

## 公開ページ

以下のGitHub Pagesから利用できます。

https://d-kitamura.github.io/LivePowerSpectrogram/

## 主な機能

* マイク入力によるリアルタイム音声解析
* 入力ゲインの調整（−30〜+40 dB，1 dB刻み）
* 時間波形のリアルタイム表示
* パワー／位相スペクトログラムのリアルタイム表示と切り替え
* 位相を0〜2π radの循環カラーマップで表示（0と2πは同じ色）
* 入力レベルの表示
* ピーク周波数の表示
* サンプルレートの表示
* 経過時間の表示
* FFTサイズの切り替え

  * 512
  * 1024
  * 2048
  * 4096
  * 8192
  * 16384
* シフト長は常に窓長（FFTサイズ）の1/8（オーバーラップ率87.5%）
* 表示周波数範囲の切り替え

  * 0–1 kHz
  * 0–2 kHz
  * 0–4 kHz
  * 0–8 kHz
  * 0–12 kHz
  * 0–16 kHz
  * 0–20 kHz
* パワースペクトログラムのdB表示下限値の調整
* 窓関数の切り替え：矩形窓，Hann窓，Hamming窓（デフォルト），Kaiser窓（β=8.6），Blackman窓
* 12秒間のスクロール表示
* ブラウザだけで動作する軽量な実装

## 想定用途

* 音の周波数成分の可視化
* 音の高さと周波数の関係の確認
* 声や楽器音のスペクトル構造の観察
* 母音・子音の違いの観察
* 音声信号の時間変化の確認
* FFTやスペクトログラムの教育デモ
* 窓関数と時間周波数解析の導入
* 音響信号処理・音声処理・音楽音響の授業や演習
* マイク入力レベルの簡易確認

## 使い方

1. 公開ページをブラウザで開きます。
2. `Start mic` ボタンを押します。
3. ブラウザからマイク使用の許可を求められた場合は，使用を許可します。
4. マイクに向かって声を出したり，楽器音や環境音を入力したりします。
5. 上段の波形表示で，音圧波形の時間変化を確認します。
6. 下段の `Display` で `Power` または `Phase` を選び，周波数成分のパワーまたは位相の時間変化を確認します。
7. 必要に応じて，`Gain`（入力ゲイン），FFTサイズ，`Window`（窓関数），表示周波数範囲，dB床値を調整します。
8. `Stop` でマイク入力を停止し，`Reset` で表示をリセットできます。

`Display` の初期値はPowerです。Phaseでは，各解析フレームのFFTの偏角を0〜2π radに変換し，0と2πが同じ色になる循環カラーマップと凡例で表示します。
位相表示にdB床値は使用せず，`Floor` は無効になります。Powerに戻すと元の床値が復元されます。録音中の切り替えではスペクトログラムだけをクリアし，波形と経過時間は継続します。
振幅が厳密に0の周波数ビンでは位相が定義できないため背景色で表示します。振幅が小さい成分の位相はノイズの影響を受けやすくなります。

`Gain` の初期値は0 dB（変更なし）です。感度の弱いマイクは正の値でブーストし，大きすぎる入力は負の値でカットできます。
例えば，+20 dBで振幅は10倍，−20 dBで1/10になります。録音中も変更でき，変更後の波形・スペクトログラム・入力レベルに反映されます。
停止・再開や `Reset` ではゲイン設定を保持します。ページを再読み込みすると0 dBに戻ります。
これはブラウザ内のソフトウェアゲインで，マイク本体やOSの入力設定は変更しません。ノイズも一緒に増幅されるため，波形が表示範囲を超える場合はゲインを下げてください。

`Window` の初期値はHamming（ハミング窓）です。Rectangular（矩形窓），Hann，Kaiser（カイザー窓，β=8.6），Blackman（ブラックマン窓）も選択できます。
窓関数は録音中も変更でき，変更時にはスペクトログラムをクリアして新しい窓で解析を続けます。シフト長はどの窓でもFFTサイズの1/8です。
窓の係数の合計で振幅を補正し，窓による正弦波のレベル差を抑えています。窓関数は周波数解析に適用され，波形表示と入力レベルには影響しません。

## 教育での利用例

### 音の高さと周波数の確認

声や楽器で音の高さを変えると，スペクトログラム上の強い成分の位置が上下に変化します。
これにより，音の高さが周波数と対応していることを直感的に確認できます。

### 声のスペクトル観察

「あ」「い」「う」「え」「お」などの母音を発声すると，スペクトログラム上に異なる周波数構造が現れます。
母音ごとのフォルマント構造や，声の高さと声質の違いを観察する導入として利用できます。

### 楽器音の倍音構造の確認

楽器音を入力すると，基音だけでなく整数倍の周波数付近に倍音成分が現れます。
音色が複数の周波数成分から構成されていることを説明する際に利用できます。

### FFTサイズの違いの確認

FFTサイズを変更すると，周波数分解能や時間変化の見え方が変わります。
短時間フーリエ変換における時間分解能と周波数分解能のトレードオフを説明する教材として利用できます。

### ノイズと定常音の違いの確認

ホワイトノイズ，拍手，口笛，持続的な母音などを入力すると，スペクトログラム上で異なるパターンが現れます。
突発音，周期音，雑音的な音の違いを視覚的に比較できます。

## ローカルでの実行方法

このリポジトリをクローンまたはダウンロードし，`index.html` をブラウザで開いてください。

```bash
git clone https://github.com/d-kitamura/LivePowerSpectrogram.git
cd LivePowerSpectrogram
```

その後，`index.html` をブラウザで開きます。

簡易HTTPサーバを使う場合は，例えば以下のように実行できます。

```bash
python -m http.server 8000
```

ブラウザで以下にアクセスします。

```text
http://localhost:8000
```

## ファイル構成

```text
LivePowerSpectrogram/
├── index.html   # アプリ本体のHTML
├── styles.css   # 画面レイアウトとデザイン
└── app.js       # マイク入力，FFT解析，描画，UI制御
```

## ブラウザとマイク使用について

このアプリはブラウザのWeb Audio APIとマイク入力機能を利用します。
利用時には，ブラウザからマイク使用の許可を求められます。

マイク入力はブラウザ上で解析・表示するために使用されます。
サーバへ音声を送信する機能は想定していません。

ブラウザやOSの設定によって，マイク入力の音量，自動ゲイン制御，ノイズ抑圧，サンプルレートなどが異なる場合があります。

## 注意

このアプリは教育・デモンストレーションを目的とした簡易ツールです。
厳密な計測器や校正済みスペクトラムアナライザの代替を目的としたものではありません。

表示されるレベルや周波数成分は，使用するマイク，オーディオインターフェース，ブラウザ，OSの音声処理設定に依存します。

## ライセンス

ライセンスは未設定です。
必要に応じて，`LICENSE` ファイルを追加してください。

---

# Live spectrogram

## Overview

**Live spectrogram** is a browser-based real-time audio analysis application.
It visualizes the time-domain waveform and either the power or phase spectrogram of microphone input in real time.

The application is useful for observing sound level, frequency components, and time-varying spectral structures.
It is intended for educational demonstrations in acoustic signal processing, acoustics, speech analysis, and music signal analysis.

It can be used to explain pitch and frequency, spectral structures of speech and musical instruments, time-frequency analysis, FFT, window functions, and spectrograms.

The application is implemented only with HTML, CSS, and JavaScript, and runs directly in a web browser without installation.

## Live Demo

The application is available via GitHub Pages:

https://d-kitamura.github.io/LivePowerSpectrogram/

## Features

* Real-time audio analysis using microphone input
* Adjustable input gain (−30 to +40 dB in 1 dB steps)
* Real-time waveform display
* Switchable real-time power and phase spectrograms
* Phase shown on a cyclic 0–2π rad color scale, with the same color at 0 and 2π
* Input level display
* Peak frequency display
* Sample rate display
* Elapsed time display
* Selectable FFT sizes:

  * 512
  * 1024
  * 2048
  * 4096
  * 8192
  * 16384
* Hop size fixed at one eighth of the window length (FFT size), giving 87.5% overlap
* Selectable frequency ranges:

  * 0–1 kHz
  * 0–2 kHz
  * 0–4 kHz
  * 0–8 kHz
  * 0–12 kHz
  * 0–16 kHz
  * 0–20 kHz
* Adjustable dB floor for power spectrogram visualization
* Selectable windows: Rectangular, Hann, Hamming (default), Kaiser (β=8.6), and Blackman
* 12-second scrolling timeline
* Lightweight browser-only implementation

## Intended Use

* Visualization of frequency components of sound
* Demonstration of the relationship between pitch and frequency
* Observation of spectral structures of speech and musical instruments
* Comparison of vowels and consonants
* Observation of time-varying audio signals
* Educational demonstration of FFT and spectrograms
* Introduction to window functions and time-frequency analysis
* Lectures and exercises in audio signal processing, speech processing, and musical acoustics
* Simple checking of microphone input level

## How to Use

1. Open the live demo page in a web browser.
2. Press the `Start mic` button.
3. Allow microphone access when prompted by the browser.
4. Speak, sing, play an instrument, or input environmental sound into the microphone.
5. Observe the time-domain waveform in the upper display.
6. Choose `Power` or `Phase` in the lower panel's `Display` control to observe changes in spectral power or phase over time.
7. Adjust `Gain` (input gain), FFT size, `Window` (window function), frequency range, and dB floor as needed.
8. Press `Stop` to stop microphone input, and `Reset` to clear the display.

`Display` defaults to Power. Phase maps each analysis frame's FFT argument to 0–2π rad and uses a cyclic color map and legend with matching colors at 0 and 2π.
Phase does not use a dB floor, so `Floor` is disabled in this mode. Switching back to Power restores the previous floor setting. Switching while recording clears only the spectrogram; the waveform and elapsed time continue.
Bins with exactly zero magnitude have undefined phase and are shown in the background color. Phase in low-amplitude components is more sensitive to noise.

`Gain` defaults to 0 dB (unchanged). Use positive values to boost a quiet microphone and negative values to cut a loud input.
For example, +20 dB multiplies the amplitude by 10, while −20 dB divides it by 10. Changes can be made while recording and apply to subsequent waveform, spectrogram, and input-level updates.
The setting is retained across stop/start and `Reset`; reloading the page restores 0 dB.
This is software gain in the browser; it does not change the microphone hardware or OS input settings. Noise is also amplified, so reduce the gain if the waveform exceeds the display range.

`Window` defaults to Hamming. Rectangular, Hann, Kaiser (β=8.6), and Blackman are also available.
Windows can be changed while recording; switching clears the spectrogram and continues analysis with the new window. The hop size remains one eighth of the FFT size for every window.
Amplitude is normalized by the sum of the window coefficients to reduce differences in sinusoidal levels between windows. Windowing applies to frequency analysis and does not affect the waveform or input-level meter.

## Educational Examples

### Pitch and Frequency

When the pitch of a voice or instrument changes, the strong components in the spectrogram move up or down.
This helps demonstrate the relationship between perceived pitch and frequency.

### Speech Spectrum Observation

By pronouncing vowels such as “a,” “i,” “u,” “e,” and “o,” different spectral patterns appear in the spectrogram.
This can be used as an introduction to formant structures and the difference between pitch and timbre.

### Harmonic Structures of Musical Sounds

Musical instrument sounds often contain not only a fundamental frequency but also harmonic components.
The spectrogram allows users to visually observe how timbre is formed by multiple frequency components.

### Effect of FFT Size

Changing the FFT size changes the frequency resolution and the appearance of temporal changes.
This is useful for explaining the trade-off between time resolution and frequency resolution in short-time Fourier transform analysis.

### Noise and Stationary Sounds

White noise, clapping, whistling, and sustained vowels produce different spectrogram patterns.
These examples can be used to compare transient sounds, periodic sounds, and noise-like sounds.

## Running Locally

Clone or download this repository and open `index.html` in a web browser.

```bash
git clone https://github.com/d-kitamura/LivePowerSpectrogram.git
cd LivePowerSpectrogram
```

Then open `index.html` in your browser.

You can also run a simple local HTTP server, for example:

```bash
python -m http.server 8000
```

Then access:

```text
http://localhost:8000
```

## File Structure

```text
LivePowerSpectrogram/
├── index.html   # Main HTML file
├── styles.css   # Layout and visual design
└── app.js       # Microphone input, FFT analysis, drawing, and UI control
```

## Browser and Microphone Access

This application uses the browser Web Audio API and microphone input.
When using the application, the browser will ask for permission to access the microphone.

The microphone input is used for analysis and visualization in the browser.
The application is not intended to send audio data to a server.

Input level, automatic gain control, noise suppression, sample rate, and other behavior may depend on the browser and operating system audio settings.

## Note

This application is intended for educational demonstrations.
It is not designed to replace calibrated measurement equipment or a precise spectrum analyzer.

The displayed levels and frequency components depend on the microphone, audio interface, browser, and operating system audio settings.

## License

No license has been specified yet.
Add a `LICENSE` file if necessary.
