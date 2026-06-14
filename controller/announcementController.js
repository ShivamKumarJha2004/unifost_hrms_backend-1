import Announcement from "../model/AnnouncementSchema.js";
import cloudinary from "../config/cloudinary.js";
//test

export const createAnnouncement = async (req, res) => {
        const { subject, targetAudience, publishedDate, expiryDate, body } = req.body;
        const imageUrl = req.body.image || req.body.imageurl || req.body.imageUrl;
        const documentUrl = req.body.document || req.body.documenturl || req.body.documentUrl;
        if (!subject || !targetAudience || !publishedDate || !expiryDate || !body) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required'
            });
        }
        const userId = req.user._id;
        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'User id is required'
            });
        }
        const announcement = await Announcement.create({ 
            subject,
            targetAudience,
            publishedDate,
            expiryDate,
            body,
            image: imageUrl || undefined,
            document: documentUrl || undefined,
            createdBy: userId 
        });
        res.status(201).json({
            status: 'success',
            message: 'Announcement created successfully',
            data: announcement
        });
    }
   export const getAnnouncement = async (req, res) => {
        const announcement = await Announcement.find();
        res.status(200).json({
            status: 'success',
            message: 'Announcement fetched successfully',
            data: announcement
        });
    }
    export const updateAnnouncement = async (req, res) => {
        const { id } = req.params;
        const { subject, targetAudience, publishedDate, expiryDate, body } = req.body;
        const imageUrl = req.body.image || req.body.imageurl || req.body.imageUrl;
        const documentUrl = req.body.document || req.body.documenturl || req.body.documentUrl;

        // Build updates only with provided fields
        const updates = { subject, targetAudience, publishedDate, expiryDate, body };
        if (imageUrl !== undefined) updates.image = imageUrl;
        if (documentUrl !== undefined) updates.document = documentUrl;

        const announcement = await Announcement.findByIdAndUpdate(id, updates, { new: true });
        res.status(200).json({
            status: 'success',
            message: 'Announcement updated successfully',
            data: announcement
        });
    }
    export const deleteAnnouncement = async (req, res) => {
        const { id } = req.params;
        const announcement = await Announcement.findByIdAndDelete(id);
        res.status(200).json({
            status: 'success',
            message: 'Announcement deleted successfully',
            data: announcement
        });
    }
    export const getAnnouncementById=async(req,res)=>{
      const raw = req.params?.id || req.query?.id || req.body?.id;
      const id = typeof raw === 'object' && raw !== null ? (raw.id || raw._id) : raw;
      if (!id) {
        return res.status(400).json({ success:false, message:"Announcement id is required" });
      }
      const announcement=await Announcement.findById(id);
      if(!announcement)
      {
        return res.status(404).json({
          sucess:false,
          messsgae:"No Announcement Found on this Id",
        })
      }
       
      return res.status(200).json({
        success: true,
        data: announcement,
        message: "Announcement fetched successfully !!"
      });

    }
    
    

export const uploadAnnouncementImage = async (req, res) => {
    try {
        const { publicId } = req.params;
        if (!publicId) {
            return res.status(400).json({
                status: 'error',
                message: 'Public ID is required'
            });
        }
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'unifost-hrms/announcement-images' });
        res.status(200).json({
            status: 'success',
            message: 'Announcement image uploaded successfully',
            data: result
        });
        const announcement = await Announcement.findByIdAndUpdate(publicId, { image: result.secure_url }, { new: true });
        await announcement.save();
        res.status(200).json({
            status: 'success',
            message: 'Announcement image uploaded successfully',
            data: announcement
        });
        
    } catch (error) {
        console.error('Upload announcement image error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error uploading announcement image',
            error: error.message
        });
    }
}
export const uploadAnnouncementDocument = async (req, res) => {
    try {
      const { publicId } = req.params;
      if (!publicId) {
        return res.status(400).json({ status: 'error', message: 'Public ID is required' });
      }
  

      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No document file provided' });
      }
  
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      if (!allowedMimes.includes(req.file.mimetype)) {
        try { await fs.unlink(req.file.path); } catch (e) { }
        return res.status(400).json({ status: 'error', message: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT' });
      }
  
      // 3. Find announcement
      const announcement = await Announcement.findById(publicId);
      if (!announcement) {
        // cleanup local file
        try { await fs.unlink(req.file.path); } catch (e) {}
        return res.status(404).json({ status: 'error', message: 'Announcement not found' });
      }
  
      // 4. Upload to Cloudinary
      const folder = 'unifost-hrms/announcement-documents';
      let uploadResult;
      try {
        uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder,
          resource_type: 'auto' // auto lets cloudinary accept pdf/docx etc.
        });
      } catch (uploadErr) {
        console.error('Cloudinary upload failed:', uploadErr);
        // cleanup local file
        try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
        return res.status(500).json({ status: 'error', message: 'Failed to upload to Cloudinary', error: uploadErr.message });
      }
  
     
      announcement.document = uploadResult.secure_url;
     
      announcement.documentPublicId = uploadResult.public_id; // e.g. 'unifost-hrms/announcement-documents/abcd1234'
      await announcement.save();
  
    
      if (announcement.document /* previously had something */ && announcement.documentPublicId) {
        await cloudinary.uploader.destroy(announcement.documentPublicId);
      }
  
      // 7. Cleanup local file
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
  
      // 8. Single success response
      return res.status(200).json({
        status: 'success',
        message: 'Announcement document uploaded successfully',
        data: {
          upload: uploadResult,
          announcement
        }
      });
  
    } catch (error) {
      console.error('Upload announcement document error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error uploading announcement document',
        error: error.message
      });
    }
  };
