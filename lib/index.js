"use strict";

var fs = require("fs"),
    async = require("async"),
    _ = require("underscore"),
    ejs = require("ejs"),
    premailer = require("premailer-client");

var premailerClient,
    globalContent;

/**
 * load all global content-snippets and prefix with "_"
 * they will be available in all templates
 *
 * @param contentDir
 * @return {*}
 */
function getGlobalContent (contentDir) {

    if(globalContent) {
        return globalContent;
    }

    var globalContentList = fs.readdirSync(contentDir),
        globalContentMap = {};

    _(globalContentList).each(function(content) {
        //only templates no dirs
        if(content.indexOf(".html") !== -1) {
            globalContentMap["_" + content.substr(0, content.length - 5)] = fs.readFileSync(contentDir + "/" + content);
        }
    });

    //cache
    globalContent = globalContentMap;
    return globalContent;
}

/**
 * load content snippets for a given email from the contents folder
 *
 * @return {Object} contentMap key-value of found snippets
 */
function loadEmailContent(contentDir, emailTitle, language) {

    var langSpecificContentPath =  contentDir + "/" + language + "/" + emailTitle;

    var contentList = fs.readdirSync(langSpecificContentPath),
        contentMap = {};

    _(contentList).each(function(content) {
        contentMap[content.substr(0, content.length - 5)] = fs.readFileSync(langSpecificContentPath + "/" + content);
    });

    _(contentMap).extend(getGlobalContent(contentDir));

    return contentMap;
}

/**
 * replace the placeholders with given contents
 *
 * @param templateDir
 * @param contentDir
 * @param emailTitle
 * @param language
 * @return {String}
 */
function compileEmail(templateDir, contentDir, emailTitle, language) {

    var emailTemplatePath = templateDir + "/" + emailTitle + ".html",
        emailTemplate,
        emailContent;

    if(!fs.existsSync(emailTemplatePath)) {
        throw new Error("Mail Template not found for '" + emailTitle + "' at path '" + emailTemplatePath + "'");
    }

    emailTemplate = fs.readFileSync(emailTemplatePath, "utf-8");
    emailContent = loadEmailContent(contentDir, emailTitle, language);

    return ejs.render(emailTemplate, emailContent);
}

/**
 * call the premailer API returns an optimized email-html
 * @param {String} emailTemplate html-email content
 * @param {Function} callback
 */
function applyPremailer(emailTemplate, callback) {

    if(premailerClient === undefined) {
        premailerClient = premailer.createClient();
    }

    premailerClient.getHTML({ html : emailTemplate }, callback);
}

/**
 * the all-in-one solution for email precompiling
 * give a src and compiled folder, add some language
 * there you go and all your templates will be precompiled
 */
function emailPreCompiler(options, callback) {

    var srcFolder = options.src,
        compiledFolder = options.target,
        language = options.language || "en",
        usePremailer = options.usePremailer || true;

    var templateDir = srcFolder + "/templates",
        contentDir = srcFolder + "/content",
        languageDir = compiledFolder + "/" + language;

    var templates = fs.readdirSync(templateDir),
        preCompiledEmails = {},
        templateName;

    function writeCompiledEmails() {

        try{
            _(preCompiledEmails).each(function(templateContent, templateName) {
                fs.writeFileSync(languageDir + "/" + templateName + ".html", templateContent, "utf-8");
            });

            return null;
        }
        catch(err) {
            return err;
        }
    }

    //compile each found email
    _(templates).each(function(template) {
        templateName = template.substr(0, template.length - 5);
        preCompiledEmails[templateName] = compileEmail(templateDir, contentDir, templateName, language);
    });

    //check for language folder
    if(!fs.existsSync(languageDir)) {
        fs.mkdirSync(languageDir);
    }

    //apply premailer
    if(usePremailer) {

        async.forEach(_(preCompiledEmails).keys(), function preMailerHelper(currentMail, callback) {

            applyPremailer(preCompiledEmails[currentMail], function(err, premailerEnhancedContent) {

                if(!err) {
                    preCompiledEmails[currentMail] = premailerEnhancedContent;
                }

                callback(null);
            });
        }, function(err){

            if(err) {
                callback(err);
            }

            callback(writeCompiledEmails());
        });
        return;
    }

    callback(writeCompiledEmails());
}

module.exports = emailPreCompiler;





