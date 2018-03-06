# email-i18n

## DEPRECATION NOTICE

We don't maintain this module anymore, please don't use it. It has some code issues and uses at least one dependency that has a known vulnerability. We didn't put it offline since we don't want to break any production code.

## What?

E-mail precompiler & optimizer for emails in different languages.
Uses ejs templates to load content-snippets in the appropriate language and pre-compile emails.

_email-i18_ has _premailer_ support built in. Which directly optimizes your emails with inline style rules.

## Usage

```javascript
var prepareEmails = require("email-i18n"),

prepareEmails(
    {
        src : __dirname + "/emails/src",
        target : __dirname + "/emails/compiled",
        lang : "en",
        usePremailer : true
    },
    function (err) { ... }
);
```
