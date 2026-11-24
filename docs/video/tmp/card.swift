import AppKit
let w=1600, h=900
let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
NSColor(red:0.086,green:0.161,blue:0.29,alpha:1).setFill(); NSRect(x:0,y:0,width:w,height:h).fill()
func t(_ s:String,_ y:CGFloat,_ sz:CGFloat,_ c:NSColor,_ bold:Bool){
 let f=NSFont(name:bold ? "Georgia-Bold":"Helvetica",size:sz)!
 let a:[NSAttributedString.Key:Any]=[.font:f,.foregroundColor:c]
 let ns=NSAttributedString(string:s,attributes:a); let sz2=ns.size(); ns.draw(at:NSPoint(x:(CGFloat(w)-sz2.width)/2,y:y))}
let cream=NSColor(red:0.953,green:0.918,blue:0.839,alpha:1), gold=NSColor(red:0.788,green:0.635,blue:0.29,alpha:1)
t("Kancelář Pro",480,110,cream,true); t("Všechna vaše práce na jednom místě",390,48,gold,false); t("Zkoušejte zdarma: kancelarpro.cz",250,52,cream,false)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"s8.png"))
