function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Server busy"})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "delete") {
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        let sheetId = String(rows[i][0]).replace(/^'/, '');
        let reqId = String(data.id).replace(/^'/, '');
        if (sheetId === reqId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: "deleted"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === "add") {
      const rows = sheet.getDataRange().getValues();
      let idExists = false;
      
      for (let i = 1; i < rows.length; i++) {
        let sheetId = String(rows[i][0]).replace(/^'/, '');
        let reqId = String(data.id).replace(/^'/, '');
        if (sheetId === reqId) {
          idExists = true;
          break;
        }
      }
      
      if (!idExists) {
        sheet.appendRow([
          "'" + String(data.id), 
          "'" + String(data.date || ""),       
          String(data.type || ""),             
          String(data.name || ""),             
          String(data.grade || ""),            
          Number(data.score) || 0,            
          String(data.angle || ""),      
          String(data.style || "")       
        ]);
      }
      return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length > 0) rows.shift(); 
  
  const logs = rows.map(row => {
    let dateVal = row[1];
    if (Object.prototype.toString.call(dateVal) === '[object Date]') {
      let m = dateVal.getMonth() + 1;
      let d = dateVal.getDate();
      dateVal = dateVal.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
    } else {
      dateVal = String(dateVal || "").replace(/^'/, '');
    }

    return {
      id: String(row[0]).replace(/^'/, ''),
      date: dateVal,
      type: String(row[2] || ""),
      name: String(row[3] || ""),
      grade: String(row[4] || ""),
      score: Number(row[5]) || 0,
      angle: String(row[6] || ""),
      style: String(row[7] || "")
    };
  });
  
  return ContentService.createTextOutput(JSON.stringify(logs)).setMimeType(ContentService.MimeType.JSON);
}
