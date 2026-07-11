# Kikillionaire 가계부 웹앱 설치 및 설정 가이드 (Setup Guide)

본 웹앱은 **Google Sheets**를 데이터베이스로 사용하고, Next.js 백엔드 API와 구글 시트의 **Google Apps Script(GAS)**를 연동하여 동작합니다. 전체 설정 프로세스는 다음과 같습니다.

---

## 1. 구글 스프레드시트 준비

구글 스프레드시트를 생성하고 아래와 같이 시트 이름과 헤더 컬럼을 설정합니다.

### 1) `Transactions` 시트 (거래 내역)
* **시트 이름:** `Transactions`
* **첫 번째 행(헤더 컬럼):**
  * `Date`, `Category`, `SubCategory`, `FromAsset`, `ToAsset`, `Amount`, `Currency`, `Merchant`, `Memo`

### 2) `Assets` 시트 (자산 목록)
* **시트 이름:** `Assets`
* **첫 번째 행(헤더 컬럼):**
  * `AssetName`, `AssetType`, `Balance`, `Currency`, `Quantity`, `Extra`

> [!IMPORTANT]
> 헤더 컬럼의 **대소문자**가 소스코드와 일치해야 합니다. 오타가 나지 않도록 주의해 주세요.

---

## 2. Google Apps Script(GAS) 설정

구글 스프레드시트와 본 Next.js 앱을 이어주는 API API 엔드포인트를 만듭니다.

1. 스프레드시트 상단 메뉴에서 **[확장 프로그램] -> [Apps Script]**를 클릭합니다.
2. 기존 코드를 모두 지우고 아래의 코드를 복사해서 붙여넣습니다:

```javascript
function doGet(e) {
  var sheetName = e.parameter.sheet;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      // Date 타입 처리
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      record[headers[j]] = val;
    }
    data.push(record);
  }
  
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var sheetName = payload.sheet;
    var rowData = payload.data;
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet not found" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'append') {
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol > 0 ? lastCol : 1).getValues()[0];
      var newRow = [];
      for (var i = 0; i < headers.length; i++) {
        newRow.push(rowData[headers[i]] !== undefined ? rowData[headers[i]] : "");
      }
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. 저장(Ctrl + S 또는 💾 아이콘)을 누릅니다.

### Apps Script 웹 앱 배포
1. 우측 상단의 **[배포] -> [새 배포]**를 선택합니다.
2. 유형 선택에서 톱니바퀴 아이콘을 누르고 **[웹 앱]**을 선택합니다.
3. 설정값을 아래와 같이 입력합니다:
   * **설명:** `Kikillionaire API` (자유롭게 입력 가능)
   * **웹 앱을 실행할 사용자:** `나(본인의 구글 계정)`
   * **액세스 권한이 있는 사용자:** **`모든 사용자` (Anyone)** (Next.js 백엔드에서 접근할 수 있어야 하므로 필수 설정)
4. **[배포]**를 누르면 액세스 승인(Authorization) 창이 뜹니다. 구글 계정을 로그인하고 권한을 허용해 줍니다.
5. 배포가 완료되면 생성된 **웹 앱 URL**을 복사합니다.
   * 주소 형태 예시: `https://script.google.com/macros/s/AKfycb.../exec`

---

## 3. 로컬 환경 변수 설정 (.env)

1. 프로젝트 루트 폴더에 `[.env.local](file:///Users/gyuwonlee/development/kikillionaire/.env.local)` 파일을 만듭니다. (이미 생성되어 있다면 열어줍니다.)
2. 위에서 복사한 웹 앱 URL을 등록합니다:

```env
NEXT_PUBLIC_GAS_URL=여기에_배포한_웹_앱_URL_입력
```

> [!NOTE]
> `[.env.local](file:///Users/gyuwonlee/development/kikillionaire/.env.local)`은 `.gitignore`에 등록되어 있어 GitHub에 푸시되지 않으므로 안심하고 저장하셔도 됩니다.
> 다른 팀원이나 환경에서는 `[.env.example](file:///Users/gyuwonlee/development/kikillionaire/.env.example)` 파일의 서식을 복사해 사용하면 됩니다.

---

## 4. Make.com 연동 가이드 (선택 사항)

메일 수신(Gmail 등) 시 구글 시트에 자동으로 거래 내역을 기록하는 자동 파싱 파이프라인을 구축할 수 있습니다.

1. **Make.com 가입 및 시나리오 생성**
2. **트리거 설정**: `Gmail` -> `Watch Emails` 모듈을 연동하여 특정 결제 알림 메일(N26, 트래블월렛 등)을 감시합니다.
3. **텍스트 파싱**: 정규식(Regex) 또는 AI 텍스트 파서를 활용하여 메일 내용에서 `금액`, `통화`, `가맹점명`, `일시`를 파싱합니다.
4. **시트 추가**: `Google Sheets` -> `Add a Row` 모듈을 연동하여 위의 **Transactions** 시트에 파싱된 데이터 형식에 맞춰 행을 추가합니다.
