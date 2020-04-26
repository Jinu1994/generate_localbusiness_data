
const fs = require('fs');
const csv = require('csvtojson');
const outputDirectory = `${__dirname}/outputfiles`
const categoryThemesDataFile = `${outputDirectory}/categoryThemes.json`;
const themeLookupDataFile = `${outputDirectory}/themeLookupData.json`;
const categoriesWithAdCopiesDataFile = `${outputDirectory}/categoriesWithAdCopies.json`;
const categoryThemesCsvFile = `${outputDirectory}/themesData.csv`;
const categoryThemesAdCopiesCsvFile = `${outputDirectory}/themesData_adcopies.csv`;
const _ = require('lodash');
const clipboardy = require('clipboardy');

const jsonToCSV=  require('json-to-csv');
 
try 
{ fs.unlinkSync(categoryThemesAdCopiesCsvFile);
} catch(error){
  // continue on error
}
// create empty json file x
fs.writeFile(categoryThemesDataFile, JSON.stringify([]), 'utf8', function () { });

var categoryThemesData = [];
var themeLookupData = {};

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const readFile = async fileName => {
    return await csv().fromFile(fileName);
}

var categoriesWithAdCopies = [];
var categoryThemesDataFlatJson = [];

var filteredCategories = [];

const addToCategoryThemesCsvJson = (item)=>{
  categoryThemesDataFlatJson.push({
    category: item.category,
    theme: item.theme,
    // keyword: item.name,
    // criterion: item.criterion,
    headline1: item.headline1,
    headline2: item.headline2,
    headline3: item.headline3,
    description1: item.description1,
    description2: item.description2,
    description3: item.description3
  })
}

const generateCsv =  async (json) => {
  try {
    await jsonToCSV(json, categoryThemesAdCopiesCsvFile)  
  } catch (err) {
    console.error(err);
  }
  
}

const addMacrofields = (adcopy) => {
  
  Object.keys(adcopy).forEach((key)=>{
    if(adcopy[key])
      adcopy[key] = adcopy[key].replace("Insert Your Business Name Here", "[business_name]")
              .replace("[Phoenix]", "[business_city]")
              .replace("[city]", "[business_city]")
              .replace("[brand]","[business_name]");
  })
}

const processFiles = async (files, filteredCategories) => {
    console.log(files.length);
    await asyncForEach(files, async file => {
        let fileName = `./keynads/${file}`;
        let campaignData = await readFile(fileName);
        let processedCampaignData = [];
        let groupedData = _.groupBy(campaignData, row => row.Campaign);
        _.forOwn(groupedData, (adgroups, campaignName) => {
            let filteredCampaignName = campaignName.replace("Campaign", "").trim();
            if (filteredCategories.length > 0 && !filteredCategories.map(c=>c.toLowerCase()).includes(filteredCampaignName.toLowerCase())){
                return;
            }
            if (filteredCampaignName) {
                let campaign = {
                    name: filteredCampaignName,
                    adgroups: []
                };
                let category = {name: filteredCampaignName };
                let adgroupsData = _.groupBy(adgroups, adg => adg['Ad Group']);
                _.forOwn(adgroupsData, (entities, adgroupName) => {
                    if (adgroupName) {
                        campaign.adgroups.push({
                            name: adgroupName
                        })

                        let ads = entities.filter(entity => entity['Headline 1'] && (entity['Description Line 1'] || entity['Description'])).map(entity => ({
                            headline1: entity['Headline 1'],
                            headline2: entity['Headline 2'],
                            headline3: entity['Headline 3'],
                            description1: entity['Description'] ? entity['Description'] :entity['Description Line 1'],
                            description2: !entity['Description'] || !entity['Description Line 1'] ? entity['Description Line 2'] : entity['Description Line 1'],
                            description3: !entity['Description'] || !entity['Description Line 1'] ? "" : entity['Description Line 2']
                        }));
                        let groupedAds = _.groupBy(ads, ad => {
                            return ad.headline1 + ad.headline2 + ad.description1 + ad.description2;
                        });
                        let adcopies = Object.values(groupedAds).reduce((a, b) => a.concat(b), []);
                        adcopies.forEach(addMacrofields);

                        let keywords = entities.filter(entity => !entity['Headline 1'] && entity.Keyword)
                        .map(entity => ({
                            name: entity.Keyword,
                            criterion: entity['Criterion Type']
                        }))
                        themeLookupData[adgroupName] = {
                            keywords,
                            ads: adcopies
                        }
                        category.adcopies = adcopies
                        adcopies.forEach(adCopy => addToCategoryThemesCsvJson({ category: category.name, theme: adgroupName, ...adCopy }));
                        // keywords.forEach(keyword => addToCategoryThemesCsvJson({ category: category.name, theme: adgroupName, ...keyword }));
                    }
                })
                processedCampaignData.push(campaign);
                categoriesWithAdCopies.push(category);
            }
        })
        categoryThemesData.push(...processedCampaignData);
    });
}




fs.readdir('./keynads', async (error, files) => {
    if (error) {
        console.log(error);
    }
    else {
        console.log(`Processing files`);
        await processFiles(files, filteredCategories);
        console.log(`Generating csv`);
        await generateCsv(categoryThemesDataFlatJson);
        console.log(`Writing to files`);
        // fs.writeFile(categoryThemesCsvFile, JSON.stringify(categoryThemesCsvData), 'utf8', function (error) { if(error) console.log(error)})
        fs.writeFile(categoryThemesDataFile, JSON.stringify(categoryThemesData), 'utf8', function () { })
        fs.writeFile(themeLookupDataFile, JSON.stringify(themeLookupData), 'utf8', function () { })
        fs.writeFile(categoriesWithAdCopiesDataFile, JSON.stringify(categoriesWithAdCopies), 'utf8', function () { })
    }
})