site.get('/nudgepad.clear', nudgepad.checkId, function(req, res, next) {
  
  res.set('Content-Type', 'text/plain')
  // We clear timelines
  exec('rm -f ' + nudgepad.paths.site + 'timelines/*.space',
    function (error, stdout, stderr) {
      
      if (stderr)
        return res.send('stderr: ' + stderr)
      if (error)
        return res.send('error: ' + error)

      return res.send('Restarting Nudge')
        process.exit(0)
  })
  

})

