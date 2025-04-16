Update Your API Functions:

// In your template loading function
const loadTemplate = async (id) => {
  const { data, error } = await getTemplateById(id);
  
  if (error) {
    toast({
      title: 'Error',
      description: 'Failed to load template'
    });
    return null;
  }
  
  // Parse and normalize data
  const templateData = parseTemplateData(data.design_data);
  
  if (!templateData) {
    toast({
      title: 'Error',
      description: 'Invalid template data format'
    });
    return null;
  }
  
  return templateData;
};



