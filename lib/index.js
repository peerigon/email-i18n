"use strict";

var fs = require("fs"),
    async = require("async"),
    path = require("path"),
    _ = require("underscore"),
    ejs = require("ejs"),
    premailer = require("premailer-client");

var premailerClient,
    globalContent,
    debug = false;

function log(msg) {
    if(debug) {
        console.log(msg);
    }
}

/**
 * load all global content-snippets and prefixed with "_"
 * they will be available in all templates
 *
 * @param contentDir
 * @return {*}
 */
function getGlobalContent (contentDir, language) {

    if(globalContent) {
        return globalContent;
    }

    function loadContentSnippets (snippetDir, prefix) {

        var snippets = fs.readdirSync(snippetDir),
            loadedSnippets = {};

        _(snippets).each(function(snippet) {
            //load international snippets
            if(snippet.indexOf(".html") !== -1) {
                loadedSnippets[prefix + snippet.substr(0, snippet.length - 5)] = fs.readFileSync(path.join(snippetDir, snippet));
            }
            else if(snippet === language){
                _(loadedSnippets).extend(loadContentSnippets(path.join(contentDir, snippet), "_"));
            }
        });

        return loadedSnippets;
    }

    //cache
    globalContent = loadContentSnippets(contentDir, "_");
    return globalContent;
}

/**
 * load content snippets for a given email from the contents folder
 *
 * @return {Object} contentMap key-value of found snippets
 */
function loadEmailContent(contentDir, emailTitle, language) {

    var langSpecificContentPath =  path.join(contentDir, language, emailTitle);

    var contentList = fs.readdirSync(langSpecificContentPath),
        contentMap = {};

    _(contentList).each(function(content) {
        //console.log("FOUND:" + content);
        contentMap[content.substr(0, content.length - 5)] = fs.readFileSync(path.join(langSpecificContentPath, content));
    });

    _(contentMap).extend(getGlobalContent(contentDir, language));
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

    var emailTemplatePath = path.join(templateDir, emailTitle + ".html"),
        emailTemplate,
        emailContent;

    if(!fs.existsSync(emailTemplatePath)) {
        throw new Error("Mail Template not found for '" + emailTitle + "' at path '" + emailTemplatePath + "'");
    }

    emailTemplate = fs.readFileSync(emailTemplatePath, "utf-8");
    emailContent = loadEmailContent(contentDir, emailTitle, language);

    log("Compiling '" + emailTitle + "' (" + language + ") with content '" +  _(emailContent).keys().join(",") + "'");

    try{
        return ejs.render(emailTemplate, emailContent);
    }
    catch(err) {
        console.log("Error compiling '" + emailTitle + "' (" + language + ") : " + err.message);
        return "RENDER failed";
    }
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

    premailerClient.getAll({ html : emailTemplate }, callback);
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
        usePremailer = options.usePremailer || false,
        writeTextVersion = options.writeTextVersion || false;

    debug = options.debug || false;

    var templateDir = path.join(srcFolder, "templates"),
        contentDir = path.join(srcFolder, "content"),
        languageDir = path.join(compiledFolder, language);

    var templates = fs.readdirSync(templateDir),
        preCompiledEmails = {},
        templateName;

    function writeCompiledEmails() {

        var htmlRenderedDir = path.join(languageDir, "html");
        var textRenderedDir = path.join(languageDir, "text");

        if(!fs.exists(htmlRenderedDir)) {
            fs.mkdir(htmlRenderedDir);
        }

        if(!fs.exists(textRenderedDir) && writeTextVersion)  {
            fs.mkdir(textRenderedDir);
        }

        try{
            _(preCompiledEmails).each(function(templateContent, templateName) {

                //html
                log("writing '" + templateName + "' -> " + htmlRenderedDir + "/" + templateName + ".html");
                fs.writeFileSync(path.join(htmlRenderedDir, templateName + ".html"), templateContent.html, "utf-8");

                //text
                if(templateContent.text !== undefined && writeTextVersion) {
                    log("writing '" + templateName + "' -> " + languageDir + "/" + templateName + ".txt");
                    fs.writeFileSync(path.join(textRenderedDir, templateName + ".txt"), templateContent.text, "utf-8");
                }
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
        preCompiledEmails[templateName] = {
            html : compileEmail(templateDir, contentDir, templateName, language)
        };
    });

    //check for language folder
    if(!fs.existsSync(languageDir)) {
        fs.mkdirSync(languageDir);
    }

    //apply premailer
    if(usePremailer) {

        async.forEach(_(preCompiledEmails).keys(), function preMailerHelper(currentMail, callback) {

            applyPremailer(preCompiledEmails[currentMail].html, function(err, documents) {

                if(err) { throw err; }

                if(!err) {
                    preCompiledEmails[currentMail] = {
                        html : documents.html,
                        text : documents.text
                    };
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